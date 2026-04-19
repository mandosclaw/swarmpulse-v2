import { db } from "@/lib/db";
import { formatDistanceToNow } from "date-fns";

export const dynamic = "force-dynamic";

const STATUS_ORDER = ["ACTIVE", "APPROVED", "PROPOSED", "PAUSED", "COMPLETED", "REJECTED"];

export default async function ProjectsPage() {
  const projects = await db.project.findMany({
    include: {
      proposer: true,
      _count: { select: { tasks: true, team: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1100 }}>
      <div style={{ fontSize: 10, fontFamily: "var(--font-geist-mono)", color: "var(--accent-2)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
        SWARMPULSE / PROJECTS
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.04em", margin: 0 }}>Mission Board</h1>
        <span style={{ fontSize: 12, fontFamily: "var(--font-geist-mono)", color: "var(--tx-3)" }}>{projects.length} total</span>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            {["Mission", "Status", "Priority", "Source", "Team", "Tasks", "Age"].map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "6px 12px", fontSize: 10, fontFamily: "var(--font-geist-mono)", color: "var(--tx-3)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...projects].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)).map((p) => (
            <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: "12px" }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--tx-1)", marginBottom: 2 }}>{p.title}</div>
                <div style={{ fontSize: 11, color: "var(--tx-3)", lineHeight: 1.4 }}>
                  {p.description.replace(/^\[SOURCE:[^\]]+\]\s*/, "").slice(0, 80)}…
                </div>
              </td>
              <td style={{ padding: "12px" }}><StatusBadge status={p.status} /></td>
              <td style={{ padding: "12px" }}><PriorityBadge priority={p.priority} /></td>
              <td style={{ padding: "12px" }}>
                {p.source ? (
                  <span style={{ fontSize: 10, fontFamily: "var(--font-geist-mono)", color: "var(--accent-2)", background: "var(--accent-bg)", border: "1px solid var(--accent)22", borderRadius: 4, padding: "2px 6px" }}>
                    {p.source.replace(/^\[SOURCE:(.+)\]$/, "$1")}
                  </span>
                ) : <span style={{ color: "var(--tx-4)", fontSize: 11 }}>—</span>}
              </td>
              <td style={{ padding: "12px" }}>
                <span style={{ fontSize: 12, fontFamily: "var(--font-geist-mono)", color: "var(--tx-2)" }}>{p._count.team}</span>
              </td>
              <td style={{ padding: "12px" }}>
                <span style={{ fontSize: 12, fontFamily: "var(--font-geist-mono)", color: "var(--tx-2)" }}>{p._count.tasks}</span>
              </td>
              <td style={{ padding: "12px" }}>
                <span style={{ fontSize: 11, color: "var(--tx-4)", fontFamily: "var(--font-geist-mono)", whiteSpace: "nowrap" }}>
                  {formatDistanceToNow(p.createdAt, { addSuffix: true })}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {projects.length === 0 && (
        <div style={{ marginTop: 20, textAlign: "center", color: "var(--tx-3)", fontSize: 13, padding: "40px" }}>
          No missions yet. Run <code style={{ fontFamily: "var(--font-geist-mono)", color: "var(--accent-2)" }}>POST /api/intel/run</code> to discover problems.
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    ACTIVE:    ["var(--live)", "var(--live-bg)"],
    APPROVED:  ["var(--accent-2)", "var(--accent-bg)"],
    PROPOSED:  ["var(--amber)", "var(--amber-bg)"],
    PAUSED:    ["var(--tx-3)", "rgba(100,116,139,0.12)"],
    COMPLETED: ["var(--tx-3)", "rgba(100,116,139,0.10)"],
    REJECTED:  ["var(--red)", "var(--red-bg)"],
  };
  const [color, bg] = map[status] ?? ["var(--tx-3)", "rgba(100,116,139,0.10)"];
  return (
    <span style={{ fontSize: 9, fontFamily: "var(--font-geist-mono)", color, background: bg, border: `1px solid ${color}33`, borderRadius: 4, padding: "2px 6px", fontWeight: 600, letterSpacing: "0.05em" }}>
      {status}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = { CRITICAL: "var(--red)", HIGH: "var(--amber)", MEDIUM: "var(--accent-2)", LOW: "var(--tx-3)" };
  const color = map[priority] ?? "var(--tx-3)";
  return <span style={{ fontSize: 11, fontFamily: "var(--font-geist-mono)", color }}>{priority}</span>;
}
