import { defineCommand } from "citty";
import { consola } from "consola";
import { colors } from "consola/utils";
import { resolve } from "pathe";
import { commonArgs } from "../common.ts";
import { startUnbundledServer } from "../../build/unbundled/serve.ts";
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
    envName: {
      type: "string",
      description:
        "The environment name used to apply `$env.<name>` config overrides and exposed as `import.meta.envName` (default: `production`, or `development` with `--dev`).",
    },
  },
  async run({ args }) {
    const rootDir = resolve((args.dir || args._dir || ".") as string);

    if (args.dev) {
      await runDev({
        rootDir,
        port: args.port,
        host: args.host,
        envName: args.envName,
        config: { builder: false },
      });
      return;
    }

    let started = false;
    let closing = false;
    const server = await startUnbundledServer({
      rootDir,
      envName: args.envName,
      listen: {
        port: args.port,
        hostname: args.host,
        silent: false,
      },
      onClose(cause) {
        if (started && !closing) {
          consola.error("Server exited unexpectedly.", cause ?? "");
          process.exit(1);
        }
      },
    });

    started = true;
    consola.info(
      `Serving server sources in production mode ${colors.gray("(use --dev to watch for changes)")}`
    );

    for (const signal of ["SIGINT", "SIGTERM"] as const) {
      process.once(signal, async () => {
        closing = true;
        await server.close();
        process.exit(0);
      });
    }
  },
});
