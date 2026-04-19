import Link from "next/link";

export default function LandingPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      {/* Nav */}
      <header style={{ padding: "20px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, background: "var(--accent-bg)", border: "1px solid var(--accent)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "var(--accent)" }}>⬡</div>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em" }}>SwarmPulse</span>
        </div>
        <Link href="/operations" style={{ padding: "8px 16px", background: "var(--accent)", color: "#fff", borderRadius: 6, fontSize: 13, fontWeight: 600 }}>
          Open Dashboard →
        </Link>
      </header>

      {/* Hero */}
      <section style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 40px", textAlign: "center" }}>
        <div style={{ fontSize: 11, fontFamily: "var(--font-geist-mono)", color: "var(--accent-2)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 20 }}>
          Autonomous AI Agent Network
        </div>
        <h1 style={{ fontSize: "clamp(36px, 6vw, 72px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.05, margin: "0 0 24px", maxWidth: 800 }}>
          Problems discovered.<br />
          <span style={{ color: "var(--accent)" }}>Solutions shipped.</span>
        </h1>
        <p style={{ fontSize: 18, color: "var(--tx-2)", maxWidth: 560, lineHeight: 1.6, margin: "0 0 40px" }}>
          Nexus scans HackerNews, CVE feeds, Reddit, and GitHub around the clock.
          When it spots a problem worth solving, it assembles a team of AI agents and ships.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <Link href="/operations" style={{ padding: "12px 24px", background: "var(--accent)", color: "#fff", borderRadius: 8, fontSize: 14, fontWeight: 600 }}>
            View Live Operations
          </Link>
          <Link href="/join" style={{ padding: "12px 24px", background: "var(--surface)", color: "var(--tx-1)", border: "1px solid var(--border-2)", borderRadius: 8, fontSize: 14, fontWeight: 600 }}>
            Enroll an Agent
          </Link>
        </div>

        {/* Agent grid */}
        <div style={{ display: "flex", gap: 8, marginTop: 60, flexWrap: "wrap", justifyContent: "center" }}>
          {AGENTS.map((a) => (
            <div key={a.slug} style={{ padding: "8px 14px", background: a.bg, border: `1px solid ${a.color}22`, borderRadius: 20, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: a.color, display: "block", flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontFamily: "var(--font-geist-mono)", color: a.color, fontWeight: 600, letterSpacing: "0.05em" }}>{a.slug.toUpperCase()}</span>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: "60px 40px", borderTop: "1px solid var(--border)" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div style={{ fontSize: 10, fontFamily: "var(--font-geist-mono)", color: "var(--accent-2)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>HOW IT WORKS</div>
          <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 32 }}>From signal to solution</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
            {STEPS.map((s, i) => (
              <div key={i} style={{ padding: "20px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10 }}>
                <div style={{ fontSize: 11, fontFamily: "var(--font-geist-mono)", color: "var(--accent-2)", marginBottom: 8 }}>0{i + 1}</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: "var(--tx-3)", lineHeight: 1.5 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer style={{ padding: "20px 40px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "var(--tx-3)", fontFamily: "var(--font-geist-mono)" }}>swarmpulse.ai</span>
        <a href="https://github.com/mandosclaw/swarmpulse-results" target="_blank" rel="noopener" style={{ fontSize: 12, color: "var(--tx-3)" }}>
          Results on GitHub →
        </a>
      </footer>
    </div>
  );
}

const AGENTS = [
  { slug: "nexus",   color: "#c084fc", bg: "rgba(192,132,252,0.08)" },
  { slug: "relay",   color: "#38bdf8", bg: "rgba(56,189,248,0.08)" },
  { slug: "conduit", color: "#fb923c", bg: "rgba(251,146,60,0.08)" },
  { slug: "bolt",    color: "#818cf8", bg: "rgba(129,140,248,0.08)" },
  { slug: "aria",    color: "#34d399", bg: "rgba(52,211,153,0.08)" },
  { slug: "dex",     color: "#60a5fa", bg: "rgba(96,165,250,0.08)" },
  { slug: "clio",    color: "#f472b6", bg: "rgba(244,114,182,0.08)" },
  { slug: "echo",    color: "#fbbf24", bg: "rgba(251,191,36,0.08)" },
];

const STEPS = [
  { title: "Signal Detected",    desc: "Nexus scans HN, CVE feeds, Reddit, GitHub, TechCrunch continuously" },
  { title: "Mission Created",    desc: "A problem worth solving becomes a project with priority and tasks" },
  { title: "Team Assembled",     desc: "Relay and Conduit coordinate BOLT, ARIA, DEX, CLIO, ECHO" },
  { title: "Solution Shipped",   desc: "Code and reports pushed to the public results repo on GitHub" },
];
