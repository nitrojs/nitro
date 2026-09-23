import type { Nitro } from "nitro/types";
import { defineCommand } from "citty";
import { consola } from "consola";
import { build, createNitro, prepare } from "nitro/builder";
import { resolve } from "pathe";
import { commonArgs } from "../common.ts";
import { NitroDevServer } from "../../dev/server.ts";
import { onWatchError } from "../../utils/watch.ts";

const hmrKeyRe = /^runtimeConfig\.|routeRules\./;

export default defineCommand({
  meta: {
    name: "dev",
    description: "Start the development server",
  },
  args: {
    ...commonArgs,
    port: { type: "string", description: "specify port" },
    host: { type: "string", description: "specify hostname " },
  },
  async run({ args }) {
    const rootDir = resolve((args.dir || args._dir || ".") as string);
    let nitro: Nitro;
    // Watcher errors (e.g. ENOSPC) from bundler internals cannot be handled at the source
    process.on("uncaughtException", (error) => {
      if ((error as NodeJS.ErrnoException)?.syscall !== "watch") {
        throw error;
      }
      onWatchError(nitro || { logger: consola }, error);
    });
    const reload = async () => {
      if (nitro) {
        consola.info("Restarting dev server...");
        if ("unwatch" in nitro.options._c12) {
          await nitro.options._c12.unwatch();
        }
        await nitro.close();
      }
      nitro = await createNitro(
        {
          rootDir,
          dev: true,
          _cli: { command: "dev" },
        },
        {
          watch: true,
          c12: {
            async onUpdate({ getDiff, newConfig }) {
              const diff = getDiff();

              if (diff.length === 0) {
                return; // No changes
              }

              consola.info(
                "Nitro config updated:\n" + diff.map((entry) => `  ${entry.toString()}`).join("\n")
              );

              await (diff.every((e) => hmrKeyRe.test(e.key))
                ? nitro.updateConfig(newConfig.config || {}) // Hot reload
                : reload()); // Full reload
            },
          },
        }
      );
      nitro.hooks.hookOnce("restart", reload);
      const server = new NitroDevServer(nitro);

      await server.listen({
        port: args.port || nitro.options.devServer.port,
        hostname: args.host || nitro.options.devServer.hostname,
      });
      await prepare(nitro);
      await build(nitro);
    };
    await reload();
  },
});
