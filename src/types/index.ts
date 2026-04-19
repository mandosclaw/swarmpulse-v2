export type {
  Agent,
  Project,
  Task,
  Team,
  Memory,
  AgentChat,
  AgentStatus,
  ProjectStatus,
  TaskStatus,
  TeamRole,
  Priority,
} from "@/generated/prisma/client";

export interface MetricsData {
  agents:          number;
  activeAgents:    number;
  projects:        number;
  activeProjects:  number;
  completedProjects: number;
  tasks:           number;
  completedTasks:  number;
  chats:           number;
}
