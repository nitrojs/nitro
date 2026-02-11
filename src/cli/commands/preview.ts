import { defineCommand } from "citty";
import { resolve } from "pathe";
import { commonArgs } from "../common.ts";
import { startPreview } from "../../preview.ts";
import { serve } from "srvx";
import { log } from "srvx/log";

export default defineCommand({
  meta: {
    name: "preview",
    description: "Start a local server to preview the built server",
  },
  args: {
    ...commonArgs,
    port: { type: "string", description: "specify port" },
    host: { type: "string", description: "specify hostname" },
  },
  async run({ args }) {
    const rootDir = resolve((args.dir || args._dir || ".") as string);

    const preview = await startPreview(rootDir);

    const server = serve({
      fetch: preview.fetch,
      middleware: [log()],
      gracefulShutdown: false,
      port: args.port,
      hostname: args.host,
    });

    process.on("SIGINT", async () => {
      await server.close();
      await preview.close();
      process.exit(0);
    });
  },
});
