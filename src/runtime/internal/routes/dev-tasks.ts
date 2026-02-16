import { H3 } from "h3";
import { runTask } from "../task.ts";

import { scheduledTasks, tasks } from "#nitro/virtual/tasks";

export default new H3()
  .get("/_nitro/tasks", async () => {
    const _tasks = await Promise.all(
      Object.entries(tasks).map(async ([name, task]) => {
        const _task = await task.resolve?.();
        return [name, { description: _task?.meta?.description }];
      })
    );
    return {
      tasks: Object.fromEntries(_tasks),
      scheduledTasks,
    };
  })
  .get("/_nitro/tasks/:name", async (event) => {
    const name = event.context.params?.name;
    const body = (await event.req.json().catch(() => ({}))) as Record<string, unknown>;
    const payload = {
      ...Object.fromEntries(event.url.searchParams.entries()),
      ...body,
    };
    return await runTask(name!, {
      context: {
        req: event.req,
        waitUntil: event.req.waitUntil,
      },
      payload,
    });
  });
