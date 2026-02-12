import { H3, HTTPError } from "h3";
import { runCronTasks } from "#nitro/runtime/task";

export default new H3().get("/_nitro/tasks/vercel", async (event) => {
  // Validate CRON_SECRET if set - https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = event.req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      throw new HTTPError("Unauthorized", { status: 401 });
    }
  }

  const cron = event.req.headers.get("x-vercel-cron-schedule");
  if (!cron) {
    throw new HTTPError("Missing x-vercel-cron-schedule header", { status: 400 });
  }

  const result = await runCronTasks(cron, {
    context: {},
    payload: {
      scheduledTime: Date.now(),
    },
  });

  return { cron, tasks: result };
});
