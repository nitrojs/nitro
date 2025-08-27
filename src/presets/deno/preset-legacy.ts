import { builtinModules } from "node:module";
import MagicString from "magic-string";
import { findStaticImports } from "mlly";
import { defineNitroPreset } from "nitropack/kit";
import { writeFile } from "nitropack/kit";
import { isAbsolute, resolve } from "pathe";

// nitro/src/rollup/plugin/import-meta.ts
const ImportMetaRe = /import\.meta|globalThis._importMeta_/;

export const denoServerLegacy = defineNitroPreset(
  {
    extends: "node-server",
    entry: "./runtime/deno-server",
    exportConditions: ["deno"],
    commands: {
      preview: "deno task --config {{ output.dir }}/deno.json start",
    },
    unenv: {
      inject: {
        global: ["unenv/polyfill/globalthis-global", "default"],
        Buffer: ["node:buffer", "Buffer"],
        setTimeout: ["node:timers", "setTimeout"],
        clearTimeout: ["node:timers", "clearTimeout"],
        setInterval: ["node:timers", "setInterval"],
        clearInterval: ["node:timers", "clearInterval"],
        setImmediate: ["node:timers", "setImmediate"],
        clearImmediate: ["node:timers", "clearImmediate"],
        // process: ["node:process", "default"],
      },
    },
    rollupConfig: {
      output: {
        hoistTransitiveImports: false,
      },
      plugins: [
        {
          name: "rollup-plugin-node-deno",
          resolveId(id) {
            id = id.replace("node:", "");
            if (builtinModules.includes(id)) {
              return {
                id: `node:${id}`,
                moduleSideEffects: false,
                external: true,
              };
            }
            if (isHTTPImport(id)) {
              return {
                id,
                external: true,
              };
            }
          },
          renderChunk(code) {
            const s = new MagicString(code);
            const imports = findStaticImports(code);
            for (const i of imports) {
              if (
                !i.specifier.startsWith(".") &&
                !isAbsolute(i.specifier) &&
                !isHTTPImport(i.specifier) &&
                !i.specifier.startsWith("npm:")
              ) {
                const specifier = i.specifier.replace("node:", "");
                s.replace(
                  i.code,
                  i.code.replace(
                    new RegExp(`(?<quote>['"])${i.specifier}\\k<quote>`),
                    JSON.stringify(
                      builtinModules.includes(specifier)
                        ? "node:" + specifier
                        : "npm:" + specifier
                    )
                  )
                );
              }
            }
            if (s.hasChanged()) {
              return {
                code: s.toString(),
                map: s.generateMap({ includeContent: true }),
              };
            }
          },
        },
        {
          name: "inject-process",
          renderChunk: {
            order: "post",
            handler(code, chunk) {
              if (
                !chunk.isEntry &&
                (!ImportMetaRe.test(code) || code.includes("ROLLUP_NO_REPLACE"))
              ) {
                return;
              }

              const s = new MagicString(code);
              s.prepend(
                "import __process__ from 'node:process';globalThis.process=globalThis.process||__process__;"
              );

              return {
                code: s.toString(),
                map: s.generateMap({ includeContent: true }),
              };
            },
          },
        },
      ],
    },
    hooks: {
      async compiled(nitro) {
        // https://deno.com/manual@v1.34.3/getting_started/configuration_file
        const denoJSON = {
          tasks: {
            start:
              "deno run --allow-net --allow-read --allow-write --allow-env --unstable-byonm ./server/index.mjs",
          },
        };
        await writeFile(
          resolve(nitro.options.output.dir, "deno.json"),
          JSON.stringify(denoJSON, null, 2)
        );
      },
    },
  },
  {
    name: "deno-server-legacy" as const,
    aliases: ["deno-server"],
    url: import.meta.url,
  }
);

const HTTP_IMPORT_RE = /^(https?:)?\/\//;

function isHTTPImport(id: string) {
  return HTTP_IMPORT_RE.test(id);
}
