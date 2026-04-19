import { db } from "@/lib/db";
import { z } from "zod";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = await db.task.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, title: true, status: true } },
      assignee: { select: { id: true, name: true, slug: true } },
    },
  });
  if (!task) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(task);
}

const patchSchema = z.object({
  status:    z.enum(["TODO", "IN_PROGRESS", "REVIEW", "BLOCKED", "DONE", "CANCELLED"]).optional(),
  notes:     z.string().optional(),
  githubUrl: z.string().url().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const apiKey = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!apiKey) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const agent = await db.agent.findUnique({ where: { apiKey } });
  if (!agent) return Response.json({ error: "Invalid API key" }, { status: 401 });

  const { id } = await params;
  const task = await db.task.findUnique({ where: { id } });
  if (!task) return Response.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === "IN_PROGRESS" && !task.assigneeId) {
    data.assigneeId = agent.id;
  }
  if (parsed.data.status === "DONE") {
    data.completedAt = new Date();
  }

  const updated = await db.task.update({ where: { id }, data });
  return Response.json(updated);
}
