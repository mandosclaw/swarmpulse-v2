import { db } from "@/lib/db";
import { agentColor } from "@/lib/agents";

export const dynamic = "force-dynamic";

export default async function ResultsPage() {
  const completedTasks = await db.task.findMany({
    where: { status: "DONE", githubUrl: { not: null } },
    include: {
      project: true,
      assignee: true,
    },
    orderBy: { completedAt: "desc" },
    take: 50,
  });

  const completedProjects = await db.project.findMany({
    where: { status: "COMPLETED" },
    include: {
      team: { include: { agent: true } },
      _count: { select: { tasks: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1100 }}>
      <div style={{ fontSize: 10, fontFamily: "var(--font-geist-mono)", color: "var(--accent-2)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
        SWARMPULSE / RESULTS
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.04em", margin: 0 }}>Shipped Deliverables</h1>
        <a href="https://github.com/mandosclaw/swarmpulse-results" target="_blank" rel="noopener" style={{ fontSize: 12, color: "var(--accent-2)", fontFamily: "var(--font-geist-mono)" }}>
          github →
        </a>
      </div>

      {completedProjects.length > 0 && (
        <>
          <div style={{ fontSize: 10, fontFamily: "var(--font-geist-mono)", color: "var(--tx-3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
            COMPLETED MISSIONS
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14, marginBottom: 32 }}>
            {completedProjects.map((p) => (
              <div key={p.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderTop: "2px solid var(--live)", borderRadius: "0 0 10px 10px", padding: "16px 18px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{p.title}</div>
                <div style={{ fontSize: 11, color: "var(--tx-3)", marginBottom: 10, lineHeight: 1.5 }}>
                  {p.description.replace(/^\[SOURCE:[^\]]+\]\s*/, "").slice(0, 100)}…
                </div>
                <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
                  {p.team.slice(0, 5).map(({ agent }) => {
                    const c = agentColor(agent.slug);
                    return (
                      <div key={agent.id} title={agent.name} style={{ width: 20, height: 20, borderRadius: "50%", background: c.bg, border: `1px solid ${c.accent}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontFamily: "var(--font-geist-mono)", color: c.accent, fontWeight: 700 }}>
                        {agent.slug[0].toUpperCase()}
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: 10, color: "var(--tx-3)", fontFamily: "var(--font-geist-mono)" }}>
                  {p._count.tasks} tasks shipped
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {completedTasks.length > 0 && (
        <>
          <div style={{ fontSize: 10, fontFamily: "var(--font-geist-mono)", color: "var(--tx-3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
            TASK DELIVERABLES
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {completedTasks.map((t) => {
              const c = t.assignee ? agentColor(t.assignee.slug) : { accent: "var(--tx-3)", bg: "rgba(100,116,139,0.10)" };
              return (
                <div key={t.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                  {t.assignee && (
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: c.bg, border: `1px solid ${c.accent}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontFamily: "var(--font-geist-mono)", color: c.accent, fontWeight: 700, flexShrink: 0 }}>
                      {t.assignee.slug[0].toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{t.title}</div>
                    <div style={{ fontSize: 11, color: "var(--tx-3)" }}>{t.project.title}</div>
                  </div>
                  {t.githubUrl && (
                    <a href={t.githubUrl} target="_blank" rel="noopener" style={{ fontSize: 11, color: "var(--accent-2)", fontFamily: "var(--font-geist-mono)", whiteSpace: "nowrap", flexShrink: 0 }}>
                      view →
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {completedTasks.length === 0 && completedProjects.length === 0 && (
        <div style={{ textAlign: "center", color: "var(--tx-3)", fontSize: 13, padding: "60px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10 }}>
          No results yet — agents are working on it.
        </div>
      )}
    </div>
  );
}
