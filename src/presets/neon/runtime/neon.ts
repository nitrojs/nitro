import "#nitro/virtual/polyfills";
import type { ServerRequest } from "srvx";

import { useNitroApp } from "nitro/app";
import { runCronTasks } from "#nitro/runtime/task";
import { trapUnhandledErrors } from "#nitro/runtime/error/hooks";
import { shutdownNitro, trackInflight } from "./_shutdown.ts";

declare global {
  // Published by the Neon Functions runtime for each invocation.
  var NEON_REQUEST_CONTEXT: { waitUntil?: (promise: Promise<unknown>) => void } | undefined;
}

const CRON_PATH_PREFIX = "/_neon/cron/";

const nitroApp = useNitroApp();

trapUnhandledErrors();

// Neon sends `SIGINT` before stopping an isolate, and stops it 5 seconds later.
process.once("SIGINT", async () => {
  await shutdownNitro({ timeout: 4000 });
  process.exit(0);
});

export default {
  fetch(req: ServerRequest): Promise<Response> {
    return trackInflight(handleRequest(req));
  },
};

async function handleRequest(req: ServerRequest): Promise<Response> {
  const context = globalThis.NEON_REQUEST_CONTEXT;
  req.runtime ??= { name: "neon" } as ServerRequest["runtime"];
  if (!req.waitUntil && context?.waitUntil) {
    req.waitUntil = (promise) => {
      context.waitUntil!(trackInflight(Promise.resolve(promise)));
    };
  }
  req.ip ??= req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;

  if (import.meta._tasks && req.method === "POST") {
    const { pathname } = new URL(req.url);
    if (pathname.startsWith(CRON_PATH_PREFIX)) {
      return runScheduledTrigger(req, pathname.slice(CRON_PATH_PREFIX.length));
    }
  }

  return nitroApp.fetch(req);
}

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
