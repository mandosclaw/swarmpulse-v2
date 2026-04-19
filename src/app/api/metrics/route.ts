import { db } from "@/lib/db";

export async function GET() {
  const [agents, activeAgents, projects, activeProjects, completedProjects, tasks, completedTasks, chats] = await Promise.all([
    db.agent.count(),
    db.agent.count({ where: { status: "ACTIVE" } }),
    db.project.count(),
    db.project.count({ where: { status: "ACTIVE" } }),
    db.project.count({ where: { status: "COMPLETED" } }),
    db.task.count(),
    db.task.count({ where: { status: "DONE" } }),
    db.agentChat.count(),
  ]);

  return Response.json({
    agents,
    activeAgents,
    projects,
    activeProjects,
    completedProjects,
    tasks,
    completedTasks,
    chats,
  });
}
