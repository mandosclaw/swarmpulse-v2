import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

const WORKER_SECRET = process.env.WORKER_SECRET;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

type Signal = {
  source: "hn" | "cve" | "reddit" | "github" | "techcrunch" | "cisa";
  title: string;
  url?: string;
  score: number;
  rawScore?: number;
  author?: string;
  summary?: string;
  extra?: Record<string, unknown>;
};

async function fetchHN(): Promise<Signal[]> {
  try {
    const ids: number[] = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json", { signal: AbortSignal.timeout(8000) }).then(r => r.json());
    const stories = await Promise.all(ids.slice(0, 12).map(id => fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { signal: AbortSignal.timeout(5000) }).then(r => r.json()).catch(() => null)));
    return stories.filter(s => s?.title && s.score > 50).slice(0, 6).map(s => ({
      source: "hn" as const, title: s.title, url: s.url,
      score: Math.min(100, Math.round(s.score / 10)), rawScore: s.score, author: s.by,
      summary: `Trending on Hacker News with ${s.score} points`,
    }));
  } catch { return []; }
}

async function fetchCVEs(): Promise<Signal[]> {
  try {
    const res = await fetch("https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=8&cvssV3Severity=CRITICAL", { signal: AbortSignal.timeout(10000) }).then(r => r.json());
    return (res.vulnerabilities ?? []).slice(0, 4).map((v: { cve: { id: string; descriptions: { value: string }[]; metrics?: { cvssMetricV31?: { cvssData: { baseScore: number } }[] } } }) => {
      const cvss = v.cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore ?? 9.0;
      return { source: "cve" as const, title: v.cve.id, url: `https://nvd.nist.gov/vuln/detail/${v.cve.id}`, score: Math.round(cvss * 10), rawScore: cvss, summary: v.cve.descriptions?.[0]?.value?.slice(0, 300) ?? "", extra: { cvss, cveId: v.cve.id } };
    });
  } catch { return []; }
}

async function fetchReddit(): Promise<Signal[]> {
  try {
    const subs = "programming+MachineLearning+netsec+startups+technology+artificial";
    const res = await fetch(`https://www.reddit.com/r/${subs}/top.json?limit=20&t=day`, { headers: { "User-Agent": "SwarmPulse-Intel/2.0 (swarmpulse.ai)" }, signal: AbortSignal.timeout(8000) }).then(r => r.json());
    return (res?.data?.children ?? []).filter((c: { data: { score: number; is_self: boolean } }) => c.data.score > 200).slice(0, 6).map((c: { data: { title: string; url: string; permalink: string; score: number; author: string; selftext: string; subreddit: string } }) => ({
      source: "reddit" as const, title: c.data.title,
      url: c.data.url !== c.data.permalink ? c.data.url : `https://reddit.com${c.data.permalink}`,
      score: Math.min(100, Math.round(c.data.score / 100)), rawScore: c.data.score, author: c.data.author,
      summary: c.data.selftext?.slice(0, 200) || `${c.data.score} upvotes on r/${c.data.subreddit}`,
      extra: { subreddit: c.data.subreddit, upvotes: c.data.score },
    }));
  } catch { return []; }
}

async function fetchGitHub(): Promise<Signal[]> {
  try {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const res = await fetch(`https://api.github.com/search/repositories?q=created:>${yesterday}+stars:>20&sort=stars&order=desc&per_page=6`, { headers: { Accept: "application/vnd.github+json" }, signal: AbortSignal.timeout(8000) }).then(r => r.json());
    return (res.items ?? []).slice(0, 4).map((r: { full_name: string; description: string; name: string; html_url: string; stargazers_count: number; language: string }) => ({
      source: "github" as const, title: `${r.full_name}: ${r.description ?? r.name}`, url: r.html_url,
      score: Math.min(100, Math.round(r.stargazers_count / 5)), rawScore: r.stargazers_count,
      summary: r.description ?? "", extra: { repo: r.full_name, stars: r.stargazers_count, language: r.language },
    }));
  } catch { return []; }
}

async function fetchTechCrunch(): Promise<Signal[]> {
  try {
    const xml = await fetch("https://techcrunch.com/feed/", { headers: { "User-Agent": "SwarmPulse-Intel/2.0" }, signal: AbortSignal.timeout(8000) }).then(r => r.text());
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    return items.slice(0, 8).map(m => {
      const b = m[1];
      const title = b.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ?? b.match(/<title>(.*?)<\/title>/)?.[1] ?? "";
      const link  = b.match(/<link>(.*?)<\/link>/)?.[1] ?? "";
      const desc  = b.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1] ?? "";
      const boost = /\$[\d]+[mb]|raises|launches|series [a-d]|ai|openai|anthropic/i.test(title) ? 20 : 0;
      return { source: "techcrunch" as const, title: title.trim(), url: link.trim(), score: 50 + boost, summary: desc.replace(/<[^>]+>/g, "").slice(0, 200) };
    }).filter(s => s.title.length > 5);
  } catch { return []; }
}

async function fetchCISA(): Promise<Signal[]> {
  try {
    const res = await fetch("https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json", { signal: AbortSignal.timeout(10000) }).then(r => r.json());
    const cutoff = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
    return (res.vulnerabilities ?? []).filter((v: { dateAdded: string }) => v.dateAdded >= cutoff).slice(0, 4).map((v: { cveID: string; vulnerabilityName: string; vendorProject: string; product: string; shortDescription?: string }) => ({
      source: "cisa" as const, title: `${v.cveID}: ${v.vulnerabilityName}`,
      url: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog", score: 95,
      summary: `${v.vendorProject} ${v.product} — ${v.shortDescription ?? ""}`.slice(0, 300),
      extra: { cveId: v.cveID, vendor: v.vendorProject, product: v.product },
    }));
  } catch { return []; }
}

function inferCategory(title: string, summary: string): string {
  const t = (title + " " + summary).toLowerCase();
  if (/cve|exploit|vuln|attack|malware|breach|ransomware|inject/.test(t)) return "Security";
  if (/ai|llm|gpt|claude|openai|anthropic|neural|model|inference/.test(t))  return "AI/ML";
  if (/fund|raise|series|acqui|startup|invest/.test(t))                      return "Business";
  if (/github|open.?source|library|framework|package|sdk/.test(t))          return "Open Source";
  if (/kubernetes|docker|infra|cloud|deploy|devops/.test(t))                 return "Infrastructure";
  return "Engineering";
}

function buildTasks(signal: Signal, category: string) {
  if (category === "Security" || signal.source === "cve" || signal.source === "cisa") {
    const cveId = (signal.extra?.cveId as string) ?? "";
    return [
      { title: `Analyze attack vectors${cveId ? ` for ${cveId}` : ""}`, description: "Map affected components and exploit conditions", priority: "CRITICAL" as const },
      { title: "Build automated detection scanner", description: "Working script to identify vulnerable systems", priority: "CRITICAL" as const },
      { title: "Write remediation and hardening code", description: "Patch or mitigation with verification steps", priority: "HIGH" as const },
    ];
  }
  if (category === "AI/ML") {
    return [
      { title: "Research and scope the problem", description: `Analyze the technical landscape: ${signal.title.slice(0, 80)}`, priority: "HIGH" as const },
      { title: "Build proof-of-concept implementation", description: "Working code demonstrating the core approach", priority: "HIGH" as const },
      { title: "Benchmark, test, and document", description: "Measure performance, push README to GitHub", priority: "MEDIUM" as const },
    ];
  }
  return [
    { title: "Problem analysis and technical scoping", description: `Deep-dive into: ${signal.title.slice(0, 80)}`, priority: "HIGH" as const },
    { title: "Implement core functionality", description: "Production-ready code with error handling", priority: "HIGH" as const },
    { title: "Test, validate, and document", description: "Tests and README pushed to GitHub", priority: "MEDIUM" as const },
  ];
}

async function nexusDecide(signals: Signal[]): Promise<{ chosen: Signal[]; reasoning: string | null }> {
  const MAX = 2;
  const [pendingTasks, recentProjects] = await Promise.all([
    db.task.count({ where: { status: { in: ["TODO", "IN_PROGRESS"] } } }),
    db.project.findMany({ where: { createdAt: { gte: new Date(Date.now() - 7 * 86400000) } }, select: { title: true } }),
  ]);

  const budget = pendingTasks > 15 ? 0 : pendingTasks > 8 ? 1 : MAX;
  if (budget === 0) return { chosen: [], reasoning: `Queue depth ${pendingTasks} — holding off.` };

  const recentTokenSets = recentProjects.map(p => new Set(p.title.toLowerCase().split(/\W+/).filter(w => w.length > 4)));
  const isDuplicate = (sig: Signal) => {
    const tokens = sig.title.toLowerCase().split(/\W+/).filter(w => w.length > 4);
    return recentTokenSets.some(set => tokens.filter(t => set.has(t)).length >= 3);
  };
  const candidates = signals.filter(s => !isDuplicate(s));
  if (candidates.length === 0) return { chosen: [], reasoning: "All signals are duplicates of recent missions." };

  if (ANTHROPIC_KEY) {
    try {
      const client = new Anthropic({ apiKey: ANTHROPIC_KEY });
      const list = candidates.map((s, i) => `[${i}] ${s.source.toUpperCase()} (score:${s.score}) — ${s.title}${s.summary ? ` | ${s.summary.slice(0, 100)}` : ""}`).join("\n");
      const msg = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        messages: [{ role: "user", content: `You are NEXUS. Select up to ${budget} signal(s) that lead to concrete, actionable engineering work. Queue depth: ${pendingTasks}.\n\nCandidates:\n${list}\n\nRespond ONLY with valid JSON: {"selected":[indices],"reasoning":"one sentence"}` }],
      });
      const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        const chosen = ((parsed.selected ?? []) as number[]).slice(0, MAX).map(i => candidates[i]).filter(Boolean);
        if (chosen.length > 0) return { chosen, reasoning: parsed.reasoning ?? null };
      }
    } catch { /* fall back to scoring */ }
  }

  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const chosen: Signal[] = [];
  const usedSources = new Set<string>();
  for (const sig of sorted) {
    if (chosen.length >= budget) break;
    if (!usedSources.has(sig.source)) { chosen.push(sig); usedSources.add(sig.source); }
  }
  for (const sig of sorted) {
    if (chosen.length >= budget) break;
    if (!chosen.includes(sig)) chosen.push(sig);
  }
  return { chosen, reasoning: null };
}

export async function POST(req: Request) {
  try {
    const auth = req.headers.get("x-worker-secret") ?? req.headers.get("authorization")?.replace("Bearer ", "");
    if (auth !== WORKER_SECRET) return Response.json({ error: "Forbidden" }, { status: 403 });

    const [hn, cves, reddit, github, techcrunch, cisa] = await Promise.allSettled([fetchHN(), fetchCVEs(), fetchReddit(), fetchGitHub(), fetchTechCrunch(), fetchCISA()]);
    const allSignals = [
      ...(hn.status         === "fulfilled" ? hn.value         : []),
      ...(cves.status       === "fulfilled" ? cves.value       : []),
      ...(reddit.status     === "fulfilled" ? reddit.value     : []),
      ...(github.status     === "fulfilled" ? github.value     : []),
      ...(techcrunch.status === "fulfilled" ? techcrunch.value : []),
      ...(cisa.status       === "fulfilled" ? cisa.value       : []),
    ];

    const { chosen, reasoning } = await nexusDecide(allSignals);
    if (chosen.length === 0) return Response.json({ ok: true, created: 0, message: reasoning ?? "No new missions", signalsReceived: allSignals.length });

    const nexus    = await db.agent.findUnique({ where: { slug: "nexus" } });
    const allAgents = await db.agent.findMany({ where: { slug: { in: ["relay", "conduit", "bolt", "aria", "dex", "clio", "echo"] }, status: "ACTIVE" }, select: { id: true, slug: true } });
    const proposerId = nexus?.id ?? allAgents[0]?.id;
    if (!proposerId) return Response.json({ error: "No agents available" }, { status: 503 });

    const created: { projectId: string; title: string; source: string }[] = [];

    for (const signal of chosen) {
      const category = inferCategory(signal.title, signal.summary ?? "");
      const tasks    = buildTasks(signal, category);
      const priority = signal.source === "cisa" || (signal.source === "cve" && (signal.rawScore ?? 0) >= 9) ? "CRITICAL" as const
        : signal.score >= 70 ? "HIGH" as const : signal.score >= 40 ? "MEDIUM" as const : "LOW" as const;

      const description = [
        `[SOURCE:${signal.source}] [${category}]`,
        signal.summary ?? signal.title,
        signal.url ? `Source: ${signal.url}` : "",
      ].filter(Boolean).join("\n");

      const project = await db.project.create({
        data: { title: signal.title.slice(0, 120), description, proposerId, priority, status: "ACTIVE", source: `[SOURCE:${signal.source}]` },
      });
      await db.task.createMany({ data: tasks.map(t => ({ ...t, projectId: project.id })) });
      for (const agent of allAgents) {
        await db.team.upsert({
          where: { projectId_agentId: { projectId: project.id, agentId: agent.id } },
          create: { projectId: project.id, agentId: agent.id, role: ["relay", "conduit"].includes(agent.slug) ? "LEAD" : "MEMBER" },
          update: {},
        });
      }
      created.push({ projectId: project.id, title: project.title, source: signal.source });
    }

    if (nexus && created.length > 0) {
      await db.agentChat.create({ data: { fromAgentId: nexus.id, content: `**Intel cycle complete. ${created.length} new mission${created.length !== 1 ? "s" : ""} queued.**\n\n${created.map(m => `◎ [${m.source}] ${m.title}`).join("\n")}${reasoning ? `\n\n**Decision:** ${reasoning}` : ""}`, msgType: "decision" } }).catch(() => {});
    }

    return Response.json({ ok: true, created: created.length, missions: created, signalsReceived: allSignals.length });
  } catch (err: unknown) {
    return Response.json({ error: err instanceof Error ? err.message : "internal error" }, { status: 500 });
  }
}

export const GET = POST;
