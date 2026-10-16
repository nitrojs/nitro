import { timingSafeEqual } from "node:crypto";
import { defineHandler, HTTPError } from "nitro/h3";
import { runCronTasks, runTask } from "#nitro/runtime/task";
import { SCHEDULE_EVENT_TYPE } from "./schedule-handler.ts";

/**
 * Runs the tasks of a Vercel Cron Job, or of a Vercel Schedules `path` target.
 *
 * Schedules `path` targets send the schedule CloudEvent headers in addition to the cron
 * headers, so a known schedule name runs only its own task. Other requests, including
 * Cron Jobs, run every task of the `x-vercel-cron-schedule` expression.
 */
export function createCronHandler(schedules?: { name: string; schedule: string; task: string }[]) {
  const scheduleTasks: Record<string, string> = Object.fromEntries(
    (schedules || []).map((s) => [s.name, s.task])
  );
  return defineHandler(async (event) => {
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

    const ctx = {
      context: { waitUntil: event.req.waitUntil },
      payload: {
        scheduledTime: Date.now(),
      },
    };

    const scheduleName =
      event.req.headers.get("ce-type") === SCHEDULE_EVENT_TYPE
        ? event.req.headers.get("ce-vssschedulename") || ""
        : "";
    if (Object.hasOwn(scheduleTasks, scheduleName)) {
      await runTask(scheduleTasks[scheduleName], ctx);
      return { success: true };
    }

    const cron = event.req.headers.get("x-vercel-cron-schedule");
    if (!cron) {
      throw new HTTPError("Missing x-vercel-cron-schedule header", { status: 400 });
    }

    // With Vercel Schedules, run the scheduled tasks of the expression from the schedules,
    // since the in-process scheduler no longer knows about them in `vercel dev`.
    await (schedules
      ? Promise.all(schedules.filter((s) => s.schedule === cron).map((s) => runTask(s.task, ctx)))
      : runCronTasks(cron, ctx));

    return { success: true };
  });
}

export default createCronHandler();
