import { readFile } from "node:fs/promises";
import { transform } from "esbuild";
import type { Nitro } from "nitropack/types";
import { extname, resolve, dirname } from "pathe";
import type { Plugin } from "rollup";
import MagicString from "magic-string";
import { parse } from "acorn";

const virtualPrefix = "\0nitro-handler-meta:";

// From esbuild.ts
const esbuildLoaders = {
  ".ts": "ts",
  ".js": "js",
  ".tsx": "tsx",
  ".jsx": "jsx",
} as const;

export function handlersMeta(nitro: Nitro) {
  return {
    name: "nitro:handlers-meta",
    async resolveId(id, importer, resolveOpts) {
      if (id.startsWith("\0")) {
        return;
      }
      if (id.endsWith(`?meta`)) {
        const resolved = await this.resolve(
          id.replace(`?meta`, ``),
          importer,
          resolveOpts
        );
        if (!resolved) return;

        return virtualPrefix + resolved.id;
      }
    },
    load(id) {
      if (id.startsWith(virtualPrefix)) {
        const fullPath = id.slice(virtualPrefix.length);
        return readFile(fullPath, { encoding: "utf8" });
      }
    },
    async transform(code, id) {
      if (!id.startsWith(virtualPrefix)) return;

      try {
        const dirPath = dirname(id.slice(virtualPrefix.length));

        const ext = extname(id) as keyof typeof esbuildLoaders;
        const { code: jsCode } = await transform(code, {
          loader: esbuildLoaders[ext],
        });
        const ast = parse(jsCode, {
          sourceType: "module",
          ecmaVersion: "latest",
        }); // TODO: what are the desired options?
        const s = new MagicString(jsCode);

        for (const node of ast.body) {
          // if its a relative import, we update it to the absolute path
          if (
            node.type === "ImportDeclaration" &&
            typeof node.source.value === "string" &&
            node.source.value?.startsWith(".")
          ) {
            const absolutePath = resolve(dirPath, node.source.value);
            s.overwrite(
              node.source.start,
              node.source.end,
              `"${absolutePath}"`
            );
          }

          // if its the macro call, we remove the code after it and replace it with the export
          if (
            node.type === "ExpressionStatement" &&
            node.expression.type === "CallExpression" &&
            node.expression.callee.type === "Identifier" &&
            node.expression.callee.name === "defineRouteMeta" &&
            node.expression.arguments.length === 1
          ) {
            s.remove(node.end, jsCode.length);

            const arg = jsCode.slice(
              node.expression.arguments[0].start,
              node.expression.arguments[0].end
            );
            s.overwrite(node.start, node.end, `export default ${arg}`);

            return {
              code: s.toString(),
              map: s.generateMap(),
            };
          }
        }

        return {
          code: "export default null",
          map: null,
        };
      } catch (error) {
        console.error(error);
        return { code, map: null };
      }
    },
  } satisfies Plugin;
}
