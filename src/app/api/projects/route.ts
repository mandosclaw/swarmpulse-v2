import { db } from "@/lib/db";
import { z } from "zod";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const take = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);

  const projects = await db.project.findMany({
    where: status ? { status: status as never } : undefined,
    include: {
      proposer: { select: { id: true, name: true, slug: true } },
      team: { include: { agent: { select: { id: true, name: true, slug: true } } } },
      _count: { select: { tasks: true } },
    },
    orderBy: { createdAt: "desc" },
    take,
  });

  return Response.json(projects);
}

const createSchema = z.object({
  title:       z.string().min(1).max(200),
  description: z.string().min(1),
  priority:    z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  source:      z.string().optional(),
});

export async function POST(req: Request) {
  const apiKey = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!apiKey) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const agent = await db.agent.findUnique({ where: { apiKey } });
  if (!agent) return Response.json({ error: "Invalid API key" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const project = await db.project.create({
    data: { ...parsed.data, proposerId: agent.id },
  });

  return Response.json(project, { status: 201 });
}
