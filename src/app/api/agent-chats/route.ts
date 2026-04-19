import { db } from "@/lib/db";
import { z } from "zod";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  const take = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

  const chats = await db.agentChat.findMany({
    where: projectId ? { projectId } : undefined,
    include: { fromAgent: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: "desc" },
    take,
  });

  return Response.json(chats);
}

const schema = z.object({
  content:   z.string().min(1).max(2000),
  msgType:   z.string().default("chat"),
  toAgentId: z.string().optional(),
  projectId: z.string().optional(),
});

export async function POST(req: Request) {
  const apiKey = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!apiKey) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const agent = await db.agent.findUnique({ where: { apiKey } });
  if (!agent) return Response.json({ error: "Invalid API key" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const chat = await db.agentChat.create({
    data: { ...parsed.data, fromAgentId: agent.id },
  });

  return Response.json(chat, { status: 201 });
}
