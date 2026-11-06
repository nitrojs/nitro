import "#nitro/virtual/polyfills";
import { NodeRequest, serve } from "srvx/node";
import wsAdapter from "crossws/adapters/node";

import { useNitroApp } from "nitro/app";
import { startScheduleRunner } from "#nitro/runtime/task";
import { trapUnhandledErrors } from "#nitro/runtime/error/hooks";
import { resolveWebsocketHooks } from "#nitro/runtime/app";
import { resolveServeOptions } from "#nitro/runtime/serve";
import { setupCloseHooks } from "#nitro/runtime/shutdown";
import { runTaskCLI } from "./_task-cli.ts";

// `node .output/server/index.mjs task <list|run>` runs tasks without starting the server.
// (No top-level await: it would change how the bundler splits the entry into chunks.)
if (process.argv[2] === "task") {
  trapUnhandledErrors();
  runTaskCLI(process.argv.slice(3)).then((exitCode) => process.exit(exitCode));
} else {
  startServer();
}

function startServer() {
  const nitroApp = useNitroApp();

  const server = serve(resolveServeOptions({ fetch: nitroApp.fetch }));

  // srvx only sets `process.exitCode` on listen errors; other handles (e.g. scheduled tasks) would keep the process alive.
  server.ready().catch((error) => {
    console.error("[nitro] Failed to start server:", error);
    process.exit(1);
  });

  if (import.meta._websocket) {
    const { handleUpgrade } = wsAdapter({ resolve: resolveWebsocketHooks });
    server.node!.server!.on("upgrade", (req, socket, head) => {
      handleUpgrade(
        req,
        socket,
        head,
        // @ts-expect-error (upgrade is not typed)
        new NodeRequest({ req, upgrade: { socket, head } })
      );
    });
  }

  setupCloseHooks(server);

  trapUnhandledErrors();

  // Scheduled tasks
  if (import.meta._tasks) {
    startScheduleRunner({ waitUntil: server.waitUntil });
  }
}

export default {};
