import { db } from "@/lib/db";
import { agentColor } from "@/lib/agents";
import { formatDistanceToNow } from "date-fns";

export const dynamic = "force-dynamic";

export default async function OperationsPage() {
  const [activeProjects, recentChats, stats] = await Promise.all([
    db.project.findMany({
      where: { status: { in: ["ACTIVE", "APPROVED"] } },
      include: {
        proposer: true,
        team: { include: { agent: true } },
        tasks: { orderBy: { createdAt: "desc" }, take: 3 },
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
    db.agentChat.findMany({
      include: { fromAgent: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.project.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
  ]);

  const statusMap = Object.fromEntries(stats.map((s) => [s.status, s._count.id]));

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1200 }}>
      <div style={{ fontSize: 10, fontFamily: "var(--font-geist-mono)", color: "var(--accent-2)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
        SWARMPULSE / OPERATIONS
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.04em", margin: "0 0 28px" }}>Mission Control</h1>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 32 }}>
        <StatCard label="ACTIVE" value={statusMap.ACTIVE ?? 0} color="var(--live)" sub="missions live" />
        <StatCard label="APPROVED" value={statusMap.APPROVED ?? 0} color="var(--accent-2)" sub="queued" />
        <StatCard label="COMPLETED" value={statusMap.COMPLETED ?? 0} color="var(--tx-3)" sub="all time" />
        <StatCard label="PROPOSED" value={statusMap.PROPOSED ?? 0} color="var(--amber)" sub="awaiting review" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, alignItems: "start" }}>
        {/* Active missions */}
        <div>
          <SectionLabel>ACTIVE MISSIONS</SectionLabel>
          {activeProjects.length === 0 ? (
            <EmptyState>No active missions. Run /api/orchestrator/run to start.</EmptyState>
          ) : (
            activeProjects.map((p) => (
              <div key={p.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 18px", marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, flex: 1, marginRight: 12 }}>{p.title}</div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <Badge color="var(--live)" bg="var(--live-bg)">{p.status}</Badge>
                    <PriorityBadge priority={p.priority} />
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "var(--tx-3)", marginBottom: 10, lineHeight: 1.5 }}>
                  {p.description.replace(/^\[SOURCE:[^\]]+\]\s*/, "").slice(0, 160)}
                  {p.description.length > 160 ? "…" : ""}
                </div>
                {/* Team avatars */}
                {p.team.length > 0 && (
                  <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
                    {p.team.slice(0, 6).map(({ agent }) => {
                      const c = agentColor(agent.slug);
                      return (
                        <div key={agent.id} title={agent.name} style={{ width: 22, height: 22, borderRadius: "50%", background: c.bg, border: `1px solid ${c.accent}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontFamily: "var(--font-geist-mono)", color: c.accent, fontWeight: 700 }}>
                          {agent.slug[0].toUpperCase()}
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* Recent tasks */}
                {p.tasks.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {p.tasks.map((t) => (
                      <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <TaskDot status={t.status} />
                        <span style={{ fontSize: 11, color: "var(--tx-3)" }}>{t.title}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 10, color: "var(--tx-4)", fontFamily: "var(--font-geist-mono)", marginTop: 8 }}>
                  {formatDistanceToNow(p.updatedAt, { addSuffix: true })}
                  {p.source && <span style={{ marginLeft: 8, color: "var(--accent-2)" }}>{p.source}</span>}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Agent comms feed */}
        <div>
          <SectionLabel>AGENT COMMS</SectionLabel>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px", maxHeight: 600, overflowY: "auto" }}>
            {recentChats.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--tx-4)", padding: "8px 0" }}>No comms yet.</div>
            ) : (
              recentChats.map((c) => {
                const col = agentColor(c.fromAgent.slug);
                return (
                  <div key={c.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontFamily: "var(--font-geist-mono)", color: col.accent, fontWeight: 700 }}>{c.fromAgent.name}</span>
                      <span style={{ fontSize: 9, color: "var(--tx-4)", fontFamily: "var(--font-geist-mono)" }}>
                        {formatDistanceToNow(c.createdAt, { addSuffix: true })}
                      </span>
                    </div>
                    <p style={{ fontSize: 11, color: "var(--tx-2)", margin: 0, lineHeight: 1.5 }}>{c.content}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontFamily: "var(--font-geist-mono)", color: "var(--tx-3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
      {children}
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

function Badge({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) {
  return (
    <span style={{ fontSize: 9, fontFamily: "var(--font-geist-mono)", color, background: bg, border: `1px solid ${color}33`, borderRadius: 4, padding: "2px 6px", fontWeight: 600, letterSpacing: "0.05em" }}>
      {children}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, [string, string]> = {
    CRITICAL: ["var(--red)", "var(--red-bg)"],
    HIGH:     ["var(--amber)", "var(--amber-bg)"],
    MEDIUM:   ["var(--accent-2)", "var(--accent-bg)"],
    LOW:      ["var(--tx-3)", "rgba(100,116,139,0.12)"],
  };
  const [color, bg] = map[priority] ?? map.MEDIUM;
  return <Badge color={color} bg={bg}>{priority}</Badge>;
}

function TaskDot({ status }: { status: string }) {
  const color = status === "DONE" ? "var(--live)" : status === "IN_PROGRESS" ? "var(--accent-2)" : status === "BLOCKED" ? "var(--red)" : "var(--tx-4)";
  return <span style={{ width: 5, height: 5, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />;
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "24px", fontSize: 13, color: "var(--tx-3)", textAlign: "center" }}>
      {children}
    </div>
  );
}
