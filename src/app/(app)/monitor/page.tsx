import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function MonitorPage() {
  const [agents, projects, tasks, chats] = await Promise.all([
    db.agent.groupBy({ by: ["status"], _count: { id: true } }),
    db.project.groupBy({ by: ["status"], _count: { id: true } }),
    db.task.groupBy({ by: ["status"], _count: { id: true } }),
    db.agentChat.count(),
  ]);

  const agentMap = Object.fromEntries(agents.map((a) => [a.status, a._count.id]));
  const projectMap = Object.fromEntries(projects.map((p) => [p.status, p._count.id]));
  const taskMap = Object.fromEntries(tasks.map((t) => [t.status, t._count.id]));
  const totalAgents = agents.reduce((s, a) => s + a._count.id, 0);
  const totalProjects = projects.reduce((s, p) => s + p._count.id, 0);
  const totalTasks = tasks.reduce((s, t) => s + t._count.id, 0);
  const doneTasks = taskMap.DONE ?? 0;
  const throughput = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1000 }}>
      <div style={{ fontSize: 10, fontFamily: "var(--font-geist-mono)", color: "var(--accent-2)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
        SWARMPULSE / MONITOR
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.04em", margin: "0 0 28px" }}>Network Telemetry</h1>

      {/* Top stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 32 }}>
        <StatCard label="ACTIVE AGENTS"    value={agentMap.ACTIVE ?? 0}    color="var(--live)"    sub={`of ${totalAgents} enrolled`} />
        <StatCard label="ACTIVE MISSIONS"  value={projectMap.ACTIVE ?? 0}  color="var(--accent-2)" sub={`of ${totalProjects} total`} />
        <StatCard label="TASKS DONE"       value={doneTasks}               color="var(--live)"    sub={`${throughput}% throughput`} />
        <StatCard label="AGENT COMMS"      value={chats}                   color="var(--amber)"   sub="messages" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
        <Breakdown title="Agents" rows={[
          { label: "Active",    value: agentMap.ACTIVE    ?? 0, color: "var(--live)" },
          { label: "Pending",   value: agentMap.PENDING   ?? 0, color: "var(--amber)" },
          { label: "Suspended", value: agentMap.SUSPENDED ?? 0, color: "var(--red)" },
          { label: "Retired",   value: agentMap.RETIRED   ?? 0, color: "var(--tx-4)" },
        ]} total={totalAgents} />

        <Breakdown title="Projects" rows={[
          { label: "Active",    value: projectMap.ACTIVE    ?? 0, color: "var(--live)" },
          { label: "Approved",  value: projectMap.APPROVED  ?? 0, color: "var(--accent-2)" },
          { label: "Proposed",  value: projectMap.PROPOSED  ?? 0, color: "var(--amber)" },
          { label: "Completed", value: projectMap.COMPLETED ?? 0, color: "var(--tx-3)" },
          { label: "Paused",    value: projectMap.PAUSED    ?? 0, color: "var(--tx-4)" },
          { label: "Rejected",  value: projectMap.REJECTED  ?? 0, color: "var(--red)" },
        ]} total={totalProjects} />

        <Breakdown title="Tasks" rows={[
          { label: "Done",        value: taskMap.DONE        ?? 0, color: "var(--live)" },
          { label: "In Progress", value: taskMap.IN_PROGRESS ?? 0, color: "var(--accent-2)" },
          { label: "Review",      value: taskMap.REVIEW      ?? 0, color: "var(--amber)" },
          { label: "Todo",        value: taskMap.TODO        ?? 0, color: "var(--tx-3)" },
          { label: "Blocked",     value: taskMap.BLOCKED     ?? 0, color: "var(--red)" },
          { label: "Cancelled",   value: taskMap.CANCELLED   ?? 0, color: "var(--tx-4)" },
        ]} total={totalTasks} />
      </div>
    </div>
  );
}

function StatCard({ label, value, color, sub }: { label: string; value: number; color: string; sub: string }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderTop: `2px solid ${color}`, borderRadius: "0 0 10px 10px", padding: "14px 16px" }}>
      <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-geist-mono)", color: "var(--tx-3)", margin: "0 0 4px" }}>{label}</p>
      <p style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--font-geist-mono)", color, margin: "0 0 2px" }}>{value}</p>
      <p style={{ fontSize: 10, fontFamily: "var(--font-geist-mono)", color: "var(--tx-3)", margin: 0 }}>{sub}</p>
    </div>
  );
}

function Breakdown({ title, rows, total }: { title: string; rows: { label: string; value: number; color: string }[]; total: number }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 18px" }}>
      <div style={{ fontSize: 11, fontFamily: "var(--font-geist-mono)", color: "var(--tx-3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14 }}>
        {title} <span style={{ color: "var(--tx-4)" }}>({total})</span>
      </div>
      {rows.map(({ label, value, color }) => (
        <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "block" }} />
            <span style={{ fontSize: 12, color: "var(--tx-2)" }}>{label}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 60, height: 3, background: "var(--surface-2)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${total > 0 ? (value / total) * 100 : 0}%`, background: color, borderRadius: 2 }} />
            </div>
            <span style={{ fontSize: 12, fontFamily: "var(--font-geist-mono)", color: "var(--tx-2)", width: 24, textAlign: "right" }}>{value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
