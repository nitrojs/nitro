import { defineHandler, HTTPError } from "nitro/h3";
import { runTask } from "#nitro/runtime/task";

// https://github.com/vercel/schedules/blob/main/docs/schedule-dispatch-protocol.md
const SCHEDULE_EVENT_TYPE = "com.vercel.schedule.v1beta";
const REQUIRED_HEADERS = [
  "ce-source",
  "ce-id",
  "ce-vssscheduleid",
  "ce-vssschedulename",
  "ce-vssnamespace",
  "ce-vssscheduledat",
  "ce-vssschedulesource",
];

/**
 * Runs the task of a Vercel Schedules dispatch.
 *
 * The function is private: only Vercel Schedules can invoke it, so no request authentication
 * is needed. Each schedule maps to exactly one task, identified by the schedule name.
 */
export function createScheduleHandler(scheduleTasks: Record<string, string>) {
  return defineHandler(async (event) => {
    const headers = event.req.headers;
    if (
      event.req.method !== "POST" ||
      headers.get("ce-specversion") !== "1.0" ||
      headers.get("ce-type") !== SCHEDULE_EVENT_TYPE
    ) {
      throw new HTTPError("Not a Vercel Schedules dispatch", { status: 400 });
    }
    const missing = REQUIRED_HEADERS.filter((name) => !headers.get(name));
    if (missing.length > 0) {
      throw new HTTPError(`Missing schedule dispatch headers: ${missing.join(", ")}`, {
        status: 400,
      });
    }

    const name = headers.get("ce-vssschedulename")!;
    const task = Object.hasOwn(scheduleTasks, name) ? scheduleTasks[name] : undefined;
    if (!task) {
      throw new HTTPError(`No task is scheduled as \`${name}\``, { status: 404 });
    }

    await runTask(task, {
      payload: { scheduledTime: Date.now() },
      context: { waitUntil: event.req.waitUntil },
    });

    return { success: true };
  });
}
