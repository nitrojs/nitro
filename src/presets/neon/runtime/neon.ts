import "#nitro/virtual/polyfills";
import type { ServerRequest } from "srvx";

import { useNitroApp, useNitroHooks } from "nitro/app";
import { runCronTasks } from "#nitro/runtime/task";
import { trapUnhandledErrors } from "#nitro/runtime/error/hooks";

declare global {
  // Published by the Neon Functions runtime for each invocation.
  var NEON_REQUEST_CONTEXT: { waitUntil?: (promise: Promise<unknown>) => void } | undefined;
}

const CRON_PATH_PREFIX = "/_neon/cron/";

const nitroApp = useNitroApp();

trapUnhandledErrors();

// Neon sends `SIGINT` before stopping an isolate, and stops it 5 seconds later.
let shuttingDown = false;
process.once("SIGINT", async () => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  try {
    await useNitroHooks().callHook("shutdown", {
      waitUntil: () => {},
      signal: AbortSignal.timeout(4500),
    });
    await useNitroHooks().callHook("close");
  } catch (error) {
    console.error("[nitro] Error while shutting down:", error);
  }
  process.exit(0);
});

export default {
  async fetch(req: ServerRequest): Promise<Response> {
    const context = globalThis.NEON_REQUEST_CONTEXT;
    req.runtime ??= { name: "neon" } as ServerRequest["runtime"];
    if (!req.waitUntil && context?.waitUntil) {
      req.waitUntil = (promise) => context.waitUntil!(Promise.resolve(promise));
    }
    req.ip ??= req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;

    if (import.meta._tasks && req.method === "POST") {
      const { pathname } = new URL(req.url);
      if (pathname.startsWith(CRON_PATH_PREFIX)) {
        return runScheduledTrigger(req, pathname.slice(CRON_PATH_PREFIX.length));
      }
    }

    return nitroApp.fetch(req);
  },
};

async function runScheduledTrigger(req: ServerRequest, encodedCron: string): Promise<Response> {
  // Neon strips client-set `X-Neon-*` headers, so this one comes from a trigger delivery.
  const invocationId = req.headers.get("x-neon-trigger-invocation-id");
  if (!invocationId) {
    return Response.json({ error: "Not a Neon Function Trigger delivery" }, { status: 401 });
  }
  const cron = Buffer.from(decodeURIComponent(encodedCron), "base64url").toString("utf8");
  const body = (await req.json().catch(() => ({}))) as { data?: { scheduled_at?: string } };
  const scheduledAt = body.data?.scheduled_at ? Date.parse(body.data.scheduled_at) : Number.NaN;
  const results = await runCronTasks(cron, {
    context: { waitUntil: req.waitUntil, neon: { invocationId } },
    payload: { scheduledTime: Number.isNaN(scheduledAt) ? Date.now() : scheduledAt },
  });
  return Response.json({ success: true, tasks: results.length });
}
