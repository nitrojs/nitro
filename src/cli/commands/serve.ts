import { defineCommand } from "citty";
import { resolve } from "pathe";
import { serve } from "srvx";
import { commonArgs } from "../common.ts";
import { startUnbundledPreview } from "../../build/unbundled/preview.ts";
import { runDev } from "./dev.ts";

export default defineCommand({
  meta: {
    name: "serve",
    description: "Start the server from the sources, without a build (`builder: false`)",
  },
  args: {
    ...commonArgs,
    port: { type: "string", description: "specify port" },
    host: { type: "string", description: "specify hostname" },
    dev: { type: "boolean", description: "start in development mode (with hot reloading)" },
  },
  async run({ args }) {
    const rootDir = resolve((args.dir || args._dir || ".") as string);

    if (args.dev) {
      await runDev({ rootDir, port: args.port, host: args.host, config: { builder: false } });
      return;
    }

    const app = await startUnbundledPreview({ rootDir, serve: true });

    const server = serve({
      fetch: (req) => app.fetch(req),
      gracefulShutdown: false,
      port: args.port || process.env.NITRO_PORT,
      hostname: args.host || process.env.NITRO_HOST,
    });

    if (app.upgrade) {
      server.node?.server?.on("upgrade", (req, socket, head) => {
        app.upgrade!(req, socket, head);
      });
    }

    for (const signal of ["SIGINT", "SIGTERM"] as const) {
      process.once(signal, async () => {
        await server.close();
        await app.close();
        process.exit(0);
      });
    }
  },
});
