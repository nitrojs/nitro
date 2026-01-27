import { readFile } from "node:fs/promises";
import { isAbsolute } from "pathe";
import { transformSync } from "oxc-transform";
import type { Expression, Literal } from "estree";
import type { Nitro, NitroEventHandler } from "nitro/types";
import type { Plugin } from "rollup";
import { escapeRegExp } from "../../utils/regex.ts";

const PREFIX = "\0nitro:route-meta:";

export function routeMeta(nitro: Nitro) {
  return {
    name: "nitro:route-meta",
    resolveId: {
      // eslint-disable-next-line no-control-regex
      filter: { id: /^(?!\u0000)(.+)\?meta$/ },
      async handler(id, importer, resolveOpts) {
        if (id.endsWith("?meta")) {
          const resolved = await this.resolve(id.replace("?meta", ""), importer, resolveOpts);
          if (!resolved) {
            return;
          }
          return PREFIX + resolved.id;
        }
      },
    },
    load: {
      filter: {
        id: new RegExp(`^${escapeRegExp(PREFIX)}`),
      },
      handler(id) {
        if (id.startsWith(PREFIX)) {
          const fullPath = id.slice(PREFIX.length);
          if (isAbsolute(fullPath)) {
            return readFile(fullPath, { encoding: "utf8" });
          } else {
            return "export default undefined;";
          }
        }
      },
    },
    transform: {
      filter: {
        id: new RegExp(`^${escapeRegExp(PREFIX)}`),
      },
      async handler(code, id) {
        let meta: NitroEventHandler["meta"] | null = null;

        try {
          const transformRes = transformSync(id, code);
          if (transformRes.errors?.length > 0) {
            for (const error of transformRes.errors) {
              this.warn(error);
            }
            return {
              code: `export default {};`,
              map: null,
            };
          }

          const ast = this.parse(transformRes.code);
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
          nitro.logger.warn(`[handlers-meta] Cannot extra route meta for: ${id}: ${error}`);
        }

        return {
          code: `export default ${JSON.stringify(meta)};`,
          map: null,
        };
      },
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
      return node.elements.map((el) => astToObject(el as any)).filter((obj) => obj !== undefined);
    }
    case "Literal": {
      return node.value;
    }
    // No default
  }
}
