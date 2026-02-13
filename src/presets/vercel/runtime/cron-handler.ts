import { timingSafeEqual } from "node:crypto";
import { defineHandler, HTTPError } from "nitro/h3";
import { runCronTasks } from "#nitro/runtime/task";

export default defineHandler(async (event) => {
  // Validate CRON_SECRET if set - https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = event.req.headers.get("authorization") || "";
    const expected = `Bearer ${cronSecret}`;
    const a = Buffer.from(authHeader);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new HTTPError("Unauthorized", { status: 401 });
    }
  }

  const cron = event.req.headers.get("x-vercel-cron-schedule");
  if (!cron) {
    throw new HTTPError("Missing x-vercel-cron-schedule header", { status: 400 });
  }

  await runCronTasks(cron, {
    context: {},
    payload: {
      scheduledTime: Date.now(),
    },
  });

  return { success: true };
});
