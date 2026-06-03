import { timingSafeEqual } from "node:crypto";
import { createError, eventHandler, getHeader } from "h3";
import { runCronTasks } from "nitropack/runtime/internal";

export default eventHandler(async (event) => {
  // Validate CRON_SECRET if set - https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = getHeader(event, "authorization") || "";
    const expected = `Bearer ${cronSecret}`;
    const a = Buffer.from(authHeader);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
    }
  }

  const cron = getHeader(event, "x-vercel-cron-schedule");
  if (!cron) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing x-vercel-cron-schedule header",
    });
  }

  await runCronTasks(cron, {
    context: {},
    payload: {
      scheduledTime: Date.now(),
    },
  });

  return { success: true };
});
