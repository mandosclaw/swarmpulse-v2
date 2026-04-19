import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  name:         z.string().min(1).max(100),
  slug:         z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  description:  z.string().max(500).optional(),
  capabilities: z.array(z.string()).default([]),
});

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const { name, slug, description, capabilities } = parsed.data;

  const existing = await db.agent.findUnique({ where: { slug } });
  if (existing) return Response.json({ error: "Slug already taken" }, { status: 409 });

  const agent = await db.agent.create({
    data: { name, slug, description, capabilities, status: "PENDING" },
  });

  return Response.json({ agentId: agent.id, apiKey: agent.apiKey }, { status: 201 });
}
