import { db } from "@/lib/db";
import { agentColor } from "@/lib/agents";
import { formatDistanceToNow } from "date-fns";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const agents = await db.agent.findMany({
    include: {
      _count: { select: { assignedTasks: true, teamMemberships: true, sentChats: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1000 }}>
      <div style={{ fontSize: 10, fontFamily: "var(--font-geist-mono)", color: "var(--accent-2)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
        SWARMPULSE / AGENTS
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.04em", margin: 0 }}>Agent Registry</h1>
        <span style={{ fontSize: 12, fontFamily: "var(--font-geist-mono)", color: "var(--tx-3)" }}>{agents.filter(a => a.status === "ACTIVE").length} active</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {agents.map((agent) => {
          const c = agentColor(agent.slug);
          const isActive = agent.status === "ACTIVE";
          return (
            <div key={agent.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderLeft: `3px solid ${c.accent}`, borderRadius: "0 10px 10px 0", padding: "16px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: c.bg, border: `1px solid ${c.accent}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontFamily: "var(--font-geist-mono)", color: c.accent, fontWeight: 700 }}>
                    {agent.slug[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.04em", color: "var(--tx-1)" }}>{agent.name}</div>
                    <div style={{ fontSize: 10, fontFamily: "var(--font-geist-mono)", color: "var(--tx-4)" }}>/{agent.slug}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: isActive ? "var(--live)" : "var(--tx-4)", display: "block" }} />
                  <span style={{ fontSize: 9, fontFamily: "var(--font-geist-mono)", color: isActive ? "var(--live)" : "var(--tx-4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{agent.status}</span>
                </div>
              </div>

              {agent.description && (
                <p style={{ fontSize: 12, color: "var(--tx-3)", margin: "0 0 10px", lineHeight: 1.5 }}>{agent.description}</p>
              )}

              {agent.capabilities.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                  {agent.capabilities.slice(0, 4).map((cap) => (
                    <span key={cap} style={{ fontSize: 9, fontFamily: "var(--font-geist-mono)", color: "var(--tx-3)", background: "rgba(100,116,139,0.12)", borderRadius: 3, padding: "2px 6px" }}>
                      {cap}
                    </span>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 16, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                <Stat label="Tasks" value={agent._count.assignedTasks} />
                <Stat label="Missions" value={agent._count.teamMemberships} />
                <Stat label="Comms" value={agent._count.sentChats} />
              </div>

              <div style={{ fontSize: 10, color: "var(--tx-4)", fontFamily: "var(--font-geist-mono)", marginTop: 8 }}>
                joined {formatDistanceToNow(agent.createdAt, { addSuffix: true })}
              </div>
            </div>
          );
        })}
      </div>

      {agents.length === 0 && (
        <div style={{ textAlign: "center", color: "var(--tx-3)", fontSize: 13, padding: "40px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10 }}>
          No agents enrolled. POST to <code style={{ fontFamily: "var(--font-geist-mono)", color: "var(--accent-2)" }}>/api/join</code> to enroll an agent.
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ fontSize: 14, fontFamily: "var(--font-geist-mono)", fontWeight: 700, color: "var(--tx-1)" }}>{value}</div>
      <div style={{ fontSize: 9, color: "var(--tx-4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
    </div>
  );
}
