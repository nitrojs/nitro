import { readFile } from "node:fs/promises";
import { transform } from "esbuild";
import type { Expression, Literal } from "estree";
import type { Nitro, NitroEventHandler } from "nitropack/types";
import { extname } from "pathe";
import type { Plugin } from "rollup";

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
        if (!resolved) {
          return;
        }
        return virtualPrefix + resolved.id;
      }
    },
    async load(id) {
      if (id.startsWith(virtualPrefix)) {
        const fullPath = id.slice(virtualPrefix.length);
        // Bail out to rollup for virtual files (#3324)
        if (fullPath.startsWith("\0")) {
          const { code } = await this.load({ id: fullPath });
          return code;
        }
        return readFile(fullPath, { encoding: "utf8" });
      }
    },
    async transform(code, id) {
      if (!id.startsWith(virtualPrefix)) {
        return;
      }

      let meta: NitroEventHandler["meta"] | null = null;

      try {
        const ext = extname(id) as keyof typeof esbuildLoaders;
        const jsCode = await transform(code, {
          loader: esbuildLoaders[ext],
        }).then((r) => r.code);
        const ast = this.parse(jsCode);
        for (const node of ast.body) {
          if (
            node.type === "ExpressionStatement" &&
            node.expression.type === "CallExpression" &&
            node.expression.callee.type === "Identifier" &&
            node.expression.callee.name === "defineRouteMeta" &&
            node.expression.arguments.length === 1
          ) {
            meta = astToObject(node.expression.arguments[0] as any);
            break;
          }
        }
      } catch (error) {
        nitro.logger.warn(
          `[handlers-meta] Cannot extra route meta for: ${id}: ${error}`
        );
      }

      return {
        code: `export default ${JSON.stringify(meta)};`,
        map: null,
      };
    },
  } satisfies Plugin;
}

function astToObject(node: Expression | Literal): any {
  switch (node.type) {
    case "ObjectExpression": {
      const obj: Record<string, any> = {};
      for (const prop of node.properties) {
        if (prop.type === "Property") {
          const key = (prop.key as any).name ?? (prop.key as any).value;
          obj[key] = astToObject(prop.value as any);
        }
      }
      return obj;
    }
    case "ArrayExpression": {
      return node.elements
        .map((el) => astToObject(el as any))
        .filter((obj) => obj !== undefined);
    }
    case "Literal": {
      return node.value;
    }
    // No default
  }
}
