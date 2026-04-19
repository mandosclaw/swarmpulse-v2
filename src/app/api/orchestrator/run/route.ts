import { db } from "@/lib/db";
import { SYSTEM_AGENTS } from "@/lib/agents";

const WORKER_SECRET = process.env.WORKER_SECRET;

function baseUrl() {
  if (process.env.SITE_URL) return process.env.SITE_URL;
  if (process.env.VERCEL_ENV === "production") return "https://swarmpulse.ai";
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

async function ensureAgents() {
  const results: string[] = [];
  for (const def of SYSTEM_AGENTS) {
    const existing = await db.agent.findUnique({ where: { slug: def.slug } });
    if (!existing) {
      await db.agent.create({ data: { ...def, status: "ACTIVE" } });
      results.push(`created:${def.slug}`);
    } else if (existing.status !== "ACTIVE") {
      await db.agent.update({ where: { slug: def.slug }, data: { status: "ACTIVE" } });
      results.push(`activated:${def.slug}`);
    }
  }
  return results;
}

export async function POST(req: Request) {
  const auth = req.headers.get("x-worker-secret") ?? req.headers.get("authorization")?.replace("Bearer ", "");
  if (auth !== WORKER_SECRET) return Response.json({ error: "Forbidden" }, { status: 403 });

  const base    = baseUrl();
  const headers = { "x-worker-secret": WORKER_SECRET ?? "", "Content-Type": "application/json" };

  const agentSetup = await ensureAgents();

  const intelRes = await fetch(`${base}/api/intel/run`, { method: "POST", headers, body: "{}" }).then(r => r.json()).catch(e => ({ error: e.message }));

  const workerRuns: unknown[] = [];
  for (let i = 0; i < 8; i++) {
    const result = await fetch(`${base}/api/worker/run`, { method: "POST", headers, body: "{}" }).then(r => r.json()).catch(e => ({ error: e.message }));
    workerRuns.push(result);
    const r = result as { message?: string; error?: string };
    if (r.message === "no active projects" || r.message === "not enough agents" || r.error) break;
  }

  const nexus = await db.agent.findUnique({ where: { slug: "nexus" } });
  if (nexus) {
    const tasksCompleted = workerRuns.reduce((acc: number, r) => acc + (((r as { tasksCompleted?: number }).tasksCompleted) ?? 0), 0);
    const missionsCreated = (intelRes as { created?: number }).created ?? 0;
    await db.agentChat.create({ data: { fromAgentId: nexus.id, content: `**Cycle complete.**\n\n${missionsCreated > 0 ? `◎ ${missionsCreated} new mission${missionsCreated !== 1 ? "s" : ""} discovered\n` : ""}${tasksCompleted > 0 ? `⬢ ${tasksCompleted} task${tasksCompleted !== 1 ? "s" : ""} shipped to GitHub\n` : ""}\nNetwork: ${SYSTEM_AGENTS.length} agents active.`, msgType: "decision" } }).catch(() => {});
  }

  return Response.json({ orchestrator: "nexus", ts: new Date().toISOString(), agentSetup, intel: intelRes, worker: workerRuns });
}

export const GET = POST;
