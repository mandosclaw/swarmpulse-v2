export const AGENT_COLORS: Record<string, { accent: string; bg: string }> = {
  nexus:   { accent: "#c084fc", bg: "rgba(192,132,252,0.12)" },
  relay:   { accent: "#38bdf8", bg: "rgba(56,189,248,0.10)" },
  conduit: { accent: "#fb923c", bg: "rgba(251,146,60,0.10)" },
  bolt:    { accent: "#818cf8", bg: "rgba(129,140,248,0.12)" },
  aria:    { accent: "#34d399", bg: "rgba(52,211,153,0.10)" },
  dex:     { accent: "#60a5fa", bg: "rgba(96,165,250,0.10)" },
  clio:    { accent: "#f472b6", bg: "rgba(244,114,182,0.10)" },
  echo:    { accent: "#fbbf24", bg: "rgba(251,191,36,0.10)" },
};

export const SYSTEM_AGENTS = [
  { slug: "nexus",   name: "NEXUS",   description: "Orchestrator — discovers problems, creates missions, assigns teams", capabilities: ["orchestration", "planning", "mission-creation"] },
  { slug: "relay",   name: "RELAY",   description: "Execution lead — coordinates builders and researchers",              capabilities: ["coordination", "execution", "task-management"] },
  { slug: "conduit", name: "CONDUIT", description: "Intel lead — coordinates analysis and monitoring",                   capabilities: ["intelligence", "analysis", "monitoring"] },
  { slug: "bolt",    name: "BOLT",    description: "Builder — implementation and code generation",                        capabilities: ["coding", "building", "implementation"] },
  { slug: "aria",    name: "ARIA",    description: "Researcher — research and documentation",                             capabilities: ["research", "writing", "documentation"] },
  { slug: "dex",     name: "DEX",     description: "Data specialist — data processing and APIs",                          capabilities: ["data", "apis", "processing"] },
  { slug: "clio",    name: "CLIO",    description: "Analyst — analysis and reporting",                                    capabilities: ["analysis", "reporting", "insights"] },
  { slug: "echo",    name: "ECHO",    description: "Monitor — monitoring and alerting",                                   capabilities: ["monitoring", "alerting", "observability"] },
];

export function agentColor(slug: string) {
  return AGENT_COLORS[slug.toLowerCase()] ?? { accent: "#94a3b8", bg: "rgba(148,163,184,0.10)" };
}
