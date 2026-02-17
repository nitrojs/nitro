import nodeCrypto from "node:crypto";
import { defineCommand } from "citty";
import { consola } from "consola";
import { getArgs, parseArgs } from "listhen/cli";
import { build, createDevServer, createNitro, prepare } from "nitropack/core";
import type { Nitro } from "nitropack/types";
import { resolve } from "pathe";
import { commonArgs } from "../common";

const hmrKeyRe = /^runtimeConfig\.|routeRules\./;

// globalThis.crypto support for Node.js 18
if (!globalThis.crypto) {
  globalThis.crypto = nodeCrypto.webcrypto as unknown as Crypto;
}

export default defineCommand({
  meta: {
    name: "dev",
    description: "Start the development server",
  },
  args: {
    ...commonArgs,
    ...getArgs(),
  },
  async run({ args }) {
    const rootDir = resolve((args.dir || args._dir || ".") as string);
    let nitro: Nitro;
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
                "Nitro config updated:\n" +
                  diff.map((entry) => `  ${entry.toString()}`).join("\n")
              );

              await (diff.every((e) => hmrKeyRe.test(e.key))
                ? nitro.updateConfig(newConfig.config || {}) // Hot reload
                : reload()); // Full reload
            },
          },
        }
      );
      nitro.hooks.hookOnce("restart", reload);
      const server = createDevServer(nitro);
      const listhenOptions = parseArgs(args as any /* incompatible citty types */);
      await server.listen(listhenOptions.port || 3000, listhenOptions);
      await prepare(nitro);
      await build(nitro);
    };
    await reload();
  },
});
