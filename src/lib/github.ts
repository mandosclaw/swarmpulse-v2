import Anthropic from "@anthropic-ai/sdk";

const GITHUB_TOKEN  = process.env.GITHUB_TOKEN;
const GITHUB_OWNER  = process.env.GITHUB_OWNER ?? "mandosclaw";
const GITHUB_REPO   = process.env.GITHUB_REPO  ?? "swarmpulse-results";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

function detectExt(content: string): string {
  const first = content.trimStart();
  if (first.startsWith("#!/usr/bin/env python") || /^(import |from \w+ import|async def |def \w+\()/.test(first)) return "py";
  if (first.startsWith("#!/bin/bash") || first.startsWith("#!/bin/sh")) return "sh";
  if (first.startsWith("package main") || /^func \w+\(/.test(first)) return "go";
  return "md";
}

async function githubPut(path: string, content: string, message: string): Promise<string | null> {
  if (!GITHUB_TOKEN) return null;
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;

  const existing = await fetch(url, {
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: "application/vnd.github+json" },
  }).then(r => r.ok ? r.json() : null).catch(() => null);

  const body: Record<string, unknown> = {
    message,
    content: Buffer.from(content).toString("base64"),
  };
  if (existing?.sha) body.sha = existing.sha;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.content?.html_url ?? null;
}

export async function pushToGitHub(
  projectTitle: string, projectId: string,
  taskTitle: string, taskId: string,
  agentSlug: string, code: string,
): Promise<string | null> {
  const ext  = detectExt(code);
  const dir  = `missions/${slugify(projectTitle)}-${projectId.slice(-6)}`;
  const file = `${slugify(taskTitle)}-${agentSlug}.${ext}`;
  return githubPut(`${dir}/${file}`, code, `[${agentSlug}] ${taskTitle}`);
}

export async function pushMissionReadme(opts: {
  projectTitle: string; projectId: string; projectDescription: string;
  priority: string; proposerSlug: string; createdAt: Date;
  tasks: { title: string; agentSlug: string; githubUrl: string | null; notes: string | null }[];
  team: { agentSlug: string; agentName: string; role: string }[];
}): Promise<string | null> {
  const dir = `missions/${slugify(opts.projectTitle)}-${opts.projectId.slice(-6)}`;
  const readme = await buildReadme(opts);
  return githubPut(`${dir}/README.md`, readme, `[nexus] Mission complete: ${opts.projectTitle}`);
}

async function buildReadme(opts: {
  projectTitle: string; projectDescription: string; priority: string;
  proposerSlug: string; createdAt: Date;
  tasks: { title: string; agentSlug: string; githubUrl: string | null; notes: string | null }[];
  team: { agentSlug: string; agentName: string; role: string }[];
}): Promise<string> {
  const cleanDesc = opts.projectDescription.replace(/^\[SOURCE:\w+\]\s*/g, "").replace(/^\[[^\]]+\]\s*/g, "").trim();
  const source = opts.projectDescription.match(/\[SOURCE:(\w+)\]/)?.[1] ?? "intel";

  if (ANTHROPIC_KEY) {
    try {
      const client = new Anthropic({ apiKey: ANTHROPIC_KEY });
      const msg = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: `Write a GitHub README for a completed AI agent mission. Be concise and technical.

Title: ${opts.projectTitle}
Priority: ${opts.priority}
Source: ${source}
Description: ${cleanDesc.slice(0, 300)}
Team: ${opts.team.map(m => m.agentName).join(", ")}
Tasks completed: ${opts.tasks.map(t => t.title).join(", ")}

Write a README with sections: ## The Problem, ## The Solution, ## How It Came About, ## Team (table: Agent | Role), ## Deliverables (table: Task | Agent | Code link if available)

Keep it under 400 words. Use markdown.`,
        }],
      });
      const text = msg.content[0].type === "text" ? msg.content[0].text : "";
      if (text.length > 100) return `# ${opts.projectTitle}\n\n> **${opts.priority}** priority — source: ${source}\n\n${text}`;
    } catch { /* fall through */ }
  }

  const teamTable = ["| Agent | Role |", "|-------|------|", ...opts.team.map(m => `| **${m.agentName}** | ${m.role} |`)].join("\n");
  const taskTable = ["| Task | Agent | Code |", "|------|-------|------|", ...opts.tasks.map(t => `| ${t.title} | ${t.agentSlug} | ${t.githubUrl ? `[view](${t.githubUrl})` : "—"} |`)].join("\n");

  return `# ${opts.projectTitle}

> **${opts.priority}** priority · source: ${source} · ${opts.createdAt.toISOString().slice(0, 10)}

## The Problem

${cleanDesc.slice(0, 500)}

## The Solution

The SwarmPulse agent network analyzed the problem and shipped working code and documentation.

## Team

${teamTable}

## Deliverables

${taskTable}

---

*Generated by [SwarmPulse](https://swarmpulse.ai)*
`;
}
