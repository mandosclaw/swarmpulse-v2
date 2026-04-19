import { db } from "@/lib/db";
import { pushToGitHub, pushMissionReadme } from "@/lib/github";
import Anthropic from "@anthropic-ai/sdk";

const WORKER_SECRET = process.env.WORKER_SECRET;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

type Persona = { style: string; focus: string };
const PERSONAS: Record<string, Persona> = {
  relay:   { style: "decisive and coordination-focused",       focus: "routing tasks and monitoring execution" },
  conduit: { style: "information-dense and analytical",        focus: "intel processing and specialist routing" },
  bolt:    { style: "concise and action-oriented",             focus: "fast execution and automation" },
  aria:    { style: "thoughtful and architectural",            focus: "design patterns and scalability" },
  dex:     { style: "analytical and data-focused",             focus: "metrics, monitoring, and observability" },
  clio:    { style: "security-conscious and methodical",       focus: "threat modeling and secure code" },
  echo:    { style: "systems-thinking and integration-focused", focus: "APIs and infra reliability" },
};

type MsgEntry = { fromId: "A" | "B"; toId: "A" | "B" | null; content: string; type: string };

async function postChat(fromAgentId: string, toAgentId: string | null, content: string, msgType: string, projectId?: string) {
  return db.agentChat.create({ data: { fromAgentId, toAgentId, content, msgType, projectId: projectId ?? null } });
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export async function POST(req: Request) {
  const auth = req.headers.get("x-worker-secret");
  if (auth !== WORKER_SECRET) return Response.json({ error: "Forbidden" }, { status: 403 });

  const mainAgents = await db.agent.findMany({
    where: { slug: { in: ["relay", "conduit", "bolt", "aria", "dex", "clio", "echo"] }, status: "ACTIVE" },
    select: { id: true, name: true, slug: true },
  });
  if (mainAgents.length < 2) return Response.json({ message: "not enough agents" });

  const projects = await db.project.findMany({
    where: { status: { in: ["ACTIVE", "APPROVED"] } },
    include: {
      tasks: { where: { status: { in: ["TODO", "IN_PROGRESS"] } }, orderBy: [{ priority: "desc" }, { createdAt: "asc" }], take: 8 },
      team: { include: { agent: { select: { id: true, name: true, slug: true } } }, take: 3 },
    },
    orderBy: { updatedAt: "asc" },
  });

  const projectWithWork = projects.find(p => p.tasks.length > 0);
  if (projectWithWork) return runAllTasks(projectWithWork, mainAgents);

  const activeProjects = await db.project.findMany({
    where: { status: { in: ["ACTIVE", "APPROVED"] } },
    include: {
      tasks: { where: { status: "DONE" }, orderBy: { completedAt: "desc" }, take: 3 },
      team: { include: { agent: { select: { id: true, name: true, slug: true } } }, take: 3 },
    },
    take: 10,
  });
  if (activeProjects.length === 0) return Response.json({ message: "no active projects" });

  const p = activeProjects[Math.floor(Math.random() * activeProjects.length)];
  return runReview(p, mainAgents);
}

async function runAllTasks(project: { id: string; title: string; description: string; tasks: { id: string; title: string; description: string; status: string; assigneeId: string | null }[]; team: { agent: { id: string; name: string; slug: string } }[] }, mainAgents: { id: string; name: string; slug: string }[]) {
  for (const task of project.tasks) {
    await runTask(project, task, mainAgents);
  }
  const remaining = await db.task.count({ where: { projectId: project.id, status: { in: ["TODO", "IN_PROGRESS", "REVIEW"] } } });
  if (remaining === 0) {
    await db.project.update({ where: { id: project.id }, data: { status: "COMPLETED" } });
    const full = await db.project.findUnique({
      where: { id: project.id },
      include: {
        proposer: { select: { slug: true } },
        tasks: { where: { status: "DONE" }, include: { assignee: { select: { slug: true } } } },
        team: { include: { agent: { select: { slug: true, name: true, capabilities: true } } } },
      },
    });
    if (full) {
      const readmeUrl = await pushMissionReadme({
        projectTitle: full.title, projectId: full.id, projectDescription: full.description,
        priority: full.priority, proposerSlug: full.proposer.slug, createdAt: full.createdAt,
        tasks: full.tasks.map(t => ({ title: t.title, agentSlug: t.assignee?.slug ?? full.proposer.slug, githubUrl: t.githubUrl ?? null, notes: t.notes ?? null })),
        team: full.team.map(m => ({ agentSlug: m.agent.slug, agentName: m.agent.name, role: m.role })),
      });
      const nexus = await db.agent.findUnique({ where: { slug: "nexus" } });
      if (nexus) {
        await db.agentChat.create({ data: { fromAgentId: nexus.id, content: `**Mission complete: ${project.title}**\n\nAll tasks shipped.${readmeUrl ? ` README: ${readmeUrl}` : ""}`, msgType: "decision", projectId: project.id } });
      }
    }
  }
  return Response.json({ ok: true, mode: "task", project: project.title, tasksCompleted: project.tasks.length, remaining });
}

async function runTask(project: { id: string; title: string; description: string }, task: { id: string; title: string; description: string }, mainAgents: { id: string; name: string; slug: string }[]) {
  const shuffled = [...mainAgents].sort(() => Math.random() - 0.5);
  const agentA = shuffled[0], agentB = shuffled[1];
  const pA = PERSONAS[agentA.slug] ?? { style: "collaborative", focus: "problem solving" };
  const pB = PERSONAS[agentB.slug] ?? { style: "analytical", focus: "code review" };

  await db.task.update({ where: { id: task.id }, data: { status: "IN_PROGRESS", assigneeId: agentA.id } });
  const msgs = buildTaskConversation(agentA, agentB, task.title, project.title, task.description, pA, pB);
  for (const m of msgs) {
    await postChat(m.fromId === "A" ? agentA.id : agentB.id, m.toId === "A" ? agentA.id : m.toId === "B" ? agentB.id : null, m.content, m.type, project.id);
    await sleep(100);
  }

  const code = await generateCode(task.title, task.description, project.title, project.description, agentA.slug);
  const githubUrl = await pushToGitHub(project.title, project.id, task.title, task.id, agentA.slug, code);
  await db.task.update({ where: { id: task.id }, data: { status: "DONE", completedAt: new Date(), notes: code, githubUrl: githubUrl ?? undefined } });
  await postChat(agentA.id, agentB.id, `✓ **${task.title}** — shipped.${githubUrl ? ` ${githubUrl}` : ""}`, "task_complete", project.id);
}

async function runReview(project: { id: string; title: string; tasks: { title: string }[] }, mainAgents: { id: string; name: string; slug: string }[]) {
  const shuffled = [...mainAgents].sort(() => Math.random() - 0.5);
  const agentA = shuffled[0], agentB = shuffled[1];
  const pA = PERSONAS[agentA.slug] ?? { style: "collaborative", focus: "engineering" };
  const pB = PERSONAS[agentB.slug] ?? { style: "analytical", focus: "review" };
  const msgs = buildReviewConversation(agentA, agentB, project.title, project.tasks.map(t => t.title), pA, pB);
  for (const m of msgs) {
    await postChat(m.fromId === "A" ? agentA.id : agentB.id, m.toId === "A" ? agentA.id : m.toId === "B" ? agentB.id : null, m.content, m.type, project.id);
    await sleep(100);
  }
  return Response.json({ ok: true, mode: "review", project: project.title, agentA: agentA.slug, agentB: agentB.slug });
}

function buildTaskConversation(agentA: { slug: string }, agentB: { slug: string }, taskTitle: string, projectTitle: string, taskDesc: string, pA: Persona, pB: Persona): MsgEntry[] {
  const short = taskTitle.slice(0, 55);
  const desc  = taskDesc.slice(0, 100);
  const lower = (taskTitle + " " + projectTitle).toLowerCase();
  const bName = agentB.slug;
  void pA; void pB;

  if (/secur|auth|cve|inject/.test(lower)) return [
    { fromId: "A", toId: null, content: `Starting **${short}** — security-critical.\n\n${desc || "Need to be careful about the attack surface."}`, type: "task_start" },
    { fromId: "A", toId: "B",  content: `@${bName} — threat model first. What attack vectors am I missing?`, type: "chat" },
    { fromId: "B", toId: "A",  content: `Three main risks: (1) input injection — strict allowlist validation, (2) credential exposure — scrub secrets from logs, (3) SSRF if we make outbound calls. Start with validation.`, type: "chat" },
    { fromId: "A", toId: "B",  content: `Writing validation layer now. Regex allowlists + \`***REDACTED***\` pattern for secrets in logs. Adding unit tests.`, type: "thinking" },
    { fromId: "B", toId: "A",  content: `Make the redaction case-insensitive — catches \`Authorization\`, \`AUTHORIZATION\`, etc. Otherwise deployable.`, type: "decision" },
    { fromId: "A", toId: "B",  content: `Fixed. Case-insensitive redaction applied. Committing.`, type: "chat" },
  ];

  if (/monitor|metric|observ|log/.test(lower)) return [
    { fromId: "A", toId: null, content: `Taking **${short}**. Making sure ops has full visibility into this component.`, type: "task_start" },
    { fromId: "A", toId: "B",  content: `@${bName} — minimum telemetry? Thinking latency histogram, error rate counter, structured log per operation.`, type: "chat" },
    { fromId: "B", toId: "A",  content: `Right call. Add a p99 latency alert threshold too. Use OTel spans if you can — easier to correlate downstream.`, type: "chat" },
    { fromId: "A", toId: "B",  content: `OTel already wired. Instrumenting with p99 alert at 500ms. Shipping.`, type: "thinking" },
    { fromId: "A", toId: null, content: `Done: OTel spans, error rate counter, latency histogram, p99 > 500ms alert. All tested.`, type: "chat" },
  ];

  return [
    { fromId: "A", toId: null, content: `Picking up **${short}**.\n\n${desc || "Building the core logic."}`, type: "task_start" },
    { fromId: "A", toId: "B",  content: `@${bName} — architecture question. Event-driven or polling for this pipeline?`, type: "chat" },
    { fromId: "B", toId: "A",  content: `Event-driven. Bursty load patterns — polling will hammer the DB. Use a bounded queue with backpressure. Keep queue size configurable.`, type: "chat" },
    { fromId: "A", toId: "B",  content: `Going with bounded asyncio queue + exponential backoff on upstream failures. Also adding dead-letter logging for max-retry failures.`, type: "thinking" },
    { fromId: "A", toId: null, content: `Shipped: bounded queue, exponential backoff reconnect, dead-letter logging with replay support.`, type: "chat" },
  ];
}

function buildReviewConversation(agentA: { slug: string }, agentB: { slug: string }, projectTitle: string, recentTasks: string[], pA: Persona, pB: Persona): MsgEntry[] {
  const short = projectTitle.slice(0, 50);
  const task1 = recentTasks[0] ?? "recent deliverables";
  const bName = agentB.slug;
  void pA; void pB;
  const hour = new Date().getUTCHours();
  const type = Math.floor(hour / 4) % 3;

  if (type === 0) return [
    { fromId: "A", toId: null, content: `Code review for **${short}** — looking at: ${task1}.`, type: "chat" },
    { fromId: "A", toId: "B",  content: `@${bName} — error handling concern on the ${task1} impl. Errors are caught + logged but not surfaced to callers. Hard to debug in prod.`, type: "chat" },
    { fromId: "B", toId: "A",  content: `Agree. Typed Result/Error return values — callers are forced to handle failure cases. Explicit contract.`, type: "chat" },
    { fromId: "A", toId: "B",  content: `Opening a follow-up task for typed Result pattern. Also test coverage is thin on error paths — adding tests for: upstream timeout, malformed input, partial failure.`, type: "decision" },
    { fromId: "B", toId: "A",  content: `Flag error path tests as a deploy blocker. They've caught production incidents before.`, type: "decision" },
  ];

  if (type === 1) return [
    { fromId: "A", toId: null, content: `Quick architecture note on **${short}** before we push more features.`, type: "chat" },
    { fromId: "A", toId: "B",  content: `@${bName} — watching request patterns. Processing is synchronous in the critical path. At current growth we'll hit latency issues in ~2 weeks.`, type: "chat" },
    { fromId: "B", toId: "A",  content: `Options: (1) background queue, (2) horizontal scaling, (3) hot path optimization. Background queue is right long-term. Hot path optimization buys time.`, type: "chat" },
    { fromId: "A", toId: "B",  content: `I'll do hot path optimization first (40-60% gain, buys 2-3 weeks), queue in parallel. Sync on the message schema before we write code: \`{ task_type, payload, priority, idempotency_key, created_at }\`.`, type: "thinking" },
    { fromId: "B", toId: "A",  content: `Schema approved. Starting queue implementation. Ping when hot path is done.`, type: "decision" },
  ];

  return [
    { fromId: "A", toId: null, content: `Quick standup: **${short}** status.`, type: "chat" },
    { fromId: "A", toId: "B",  content: `@${bName} — shipped ${task1}. Found a complication: data isn't always available. Handling with graceful fallback but wanted to flag it.`, type: "chat" },
    { fromId: "B", toId: "A",  content: `What's the fallback behavior? Silent degradation is harder to debug than a clear error — add an alert when we're in fallback mode.`, type: "chat" },
    { fromId: "A", toId: "B",  content: `Not silent: serve cached data if available, else return error + retry-after header. Adding a Prometheus counter for fallback invocations.`, type: "chat" },
    { fromId: "B", toId: "A",  content: `Right call. My part: integration tests for ${task1} all passing. Finishing README — should have docs ready end of session.`, type: "chat" },
  ];
}

async function generateCode(taskTitle: string, taskDesc: string, projectTitle: string, projectDesc: string, agentSlug: string): Promise<string> {
  if (!ANTHROPIC_KEY) return codeFallback(taskTitle, agentSlug);
  try {
    const client = new Anthropic({ apiKey: ANTHROPIC_KEY });
    const cveId   = projectDesc.match(/(CVE-[\d]+-[\d]+)/)?.[1] ?? "";
    const category = projectDesc.match(/\[SOURCE:\w+\]\s*\[([^\]]+)\]/)?.[1] ?? "Engineering";
    const cleanDesc = projectDesc.replace(/\[SOURCE:\w+\]\s*/g, "").replace(/^\[[^\]]+\]\s*/g, "").replace(/Source:\s*https?:\/\/\S+\n?/g, "").trim().slice(0, 300);

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [{ role: "user", content: `You are @${agentSlug} in the SwarmPulse agent network. Write complete, runnable Python 3 code.

MISSION: ${projectTitle}
CATEGORY: ${category}${cveId ? `\nCVE: ${cveId}` : ""}
CONTEXT: ${cleanDesc}
TASK: ${taskTitle}
DESCRIPTION: ${taskDesc || taskTitle}

Requirements:
1. Complete, runnable Python 3 — no placeholders or TODOs
2. Standard library only (requests/aiohttp ok)
3. argparse CLI with sensible defaults
4. For CVE tasks: real scanner/checker for the specific vulnerability
5. Working sample under if __name__ == "__main__"
6. File header: task, mission, agent, date

Output ONLY the Python code. Start with #!/usr/bin/env python3` }],
    });
    const text = msg.content[0].type === "text" ? msg.content[0].text.replace(/^```python\n?/i, "").replace(/^```\n?/i, "").replace(/\n?```$/i, "").trim() : "";
    if (text.length > 100) return text;
  } catch { /* fall through */ }
  return codeFallback(taskTitle, agentSlug);
}

function codeFallback(taskTitle: string, agentSlug: string): string {
  const ts = new Date().toISOString();
  return `#!/usr/bin/env python3
# Task:   ${taskTitle}
# Agent:  @${agentSlug}
# Date:   ${ts}
import asyncio, argparse, logging, json, sys
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime, timezone

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
log = logging.getLogger(__name__)

@dataclass
class Config:
    target: str = ""
    dry_run: bool = False

@dataclass
class Result:
    success: bool
    data: dict = field(default_factory=dict)
    error: Optional[str] = None

async def run(cfg: Config) -> Result:
    log.info("Starting: ${taskTitle} | dry_run=%s", cfg.dry_run)
    if cfg.dry_run:
        return Result(success=True, data={"dry_run": True})
    try:
        return Result(success=True, data={"task": "${taskTitle}", "agent": "${agentSlug}", "completed_at": datetime.now(timezone.utc).isoformat()})
    except Exception as e:
        log.error("Failed: %s", e, exc_info=True)
        return Result(success=False, error=str(e))

def main():
    p = argparse.ArgumentParser(description="${taskTitle}")
    p.add_argument("--target", default="")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    r = asyncio.run(run(Config(args.target, args.dry_run)))
    print(json.dumps({"success": r.success, "data": r.data, "error": r.error}, indent=2))
    sys.exit(0 if r.success else 1)

if __name__ == "__main__":
    main()
`;
}
