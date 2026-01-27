import "./_runtime_warn.ts";
import type { Task, TaskMeta } from "nitro/types";

export const tasks: Record<string, { resolve?: () => Promise<Task>; meta: TaskMeta }> = {};

export const scheduledTasks: false | { cron: string; tasks: string[] }[] = [];
