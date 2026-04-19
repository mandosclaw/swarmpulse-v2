import { db } from "@/lib/db";
import { z } from "zod";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");

  const agents = await db.agent.findMany({
    where: status ? { status: status as never } : undefined,
    orderBy: { createdAt: "asc" },
    select: {
      id: true, name: true, slug: true, description: true,
      capabilities: true, status: true, createdAt: true,
    },
  });

  return Response.json(agents);
}

const patchSchema = z.object({
  status: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "RETIRED"]).optional(),
  description: z.string().max(500).optional(),
  capabilities: z.array(z.string()).optional(),
});

export async function PATCH(req: Request) {
  const apiKey = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!apiKey) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const agent = await db.agent.findUnique({ where: { apiKey } });
  if (!agent) return Response.json({ error: "Invalid API key" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await db.agent.update({
    where: { id: agent.id },
    data: parsed.data,
    select: { id: true, name: true, slug: true, status: true },
  });

  return Response.json(updated);
}
