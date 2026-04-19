"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { MetricsData } from "@/types";

const NAV = [
  { href: "/operations", label: "Operations",  icon: "◈" },
  { href: "/projects",   label: "Projects",    icon: "⬡" },
  { href: "/agents",     label: "Agents",      icon: "◎" },
  { href: "/results",    label: "Results",     icon: "▣" },
  { href: "/monitor",    label: "Monitor",     icon: "⊕" },
  { href: "/join",       label: "Join",        icon: "⊞" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [metrics, setMetrics] = useState<MetricsData | null>(null);

  useEffect(() => {
    fetch("/api/metrics")
      .then((r) => r.json())
      .then(setMetrics)
      .catch(() => null);
    const id = setInterval(() => {
      fetch("/api/metrics")
        .then((r) => r.json())
        .then(setMetrics)
        .catch(() => null);
    }, 15_000);
    return () => clearInterval(id);
  }, []);

  return (
    <aside style={{
      width: "var(--sidebar-w)",
      minHeight: "100vh",
      background: "var(--surface)",
      borderRight: "1px solid var(--border)",
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
      position: "sticky",
      top: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid var(--border)" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28,
            background: "var(--accent-bg)",
            border: "1px solid var(--accent)",
            borderRadius: 6,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, color: "var(--accent)",
          }}>⬡</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--tx-1)" }}>SwarmPulse</div>
            <div style={{ fontSize: 9, fontFamily: "var(--font-geist-mono)", color: "var(--accent-2)", letterSpacing: "0.1em", textTransform: "uppercase" }}>NETWORK</div>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav style={{ padding: "8px 8px", flex: 1 }}>
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href} style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 10px",
              borderRadius: 6,
              marginBottom: 2,
              fontSize: 13,
              fontWeight: active ? 600 : 400,
              color: active ? "var(--accent-2)" : "var(--tx-2)",
              background: active ? "var(--accent-bg)" : "transparent",
              transition: "all 0.12s",
            }}>
              <span style={{ fontSize: 12, opacity: 0.8 }}>{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Stats */}
      <div style={{ padding: "12px 16px 20px", borderTop: "1px solid var(--border)" }}>
        <div style={{ fontSize: 9, fontFamily: "var(--font-geist-mono)", color: "var(--tx-3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>NETWORK</div>
        <StatRow label="Agents"   value={metrics?.activeAgents ?? "—"} color="var(--live)" />
        <StatRow label="Active"   value={metrics?.activeProjects ?? "—"} color="var(--accent-2)" />
        <StatRow label="Done"     value={metrics?.completedProjects ?? "—"} color="var(--tx-3)" />
      </div>
    </aside>
  );
}

function StatRow({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
      <span style={{ fontSize: 11, color: "var(--tx-3)" }}>{label}</span>
      <span style={{ fontSize: 12, fontFamily: "var(--font-geist-mono)", fontWeight: 600, color }}>{value}</span>
    </div>
  );
}
