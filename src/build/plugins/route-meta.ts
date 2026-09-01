import { readFile } from "node:fs/promises";
import { isAbsolute } from "pathe";
import type { Expression, Literal } from "estree";
import type { Nitro, NitroEventHandler } from "nitro/types";
import type { Plugin } from "rollup";
import { escapeRegExp } from "../../utils/regex.ts";
import { createRouteResponseSchemaGenerator } from "./_route-response-schema.ts";

const PREFIX = "\0nitro:route-meta:";

export async function routeMeta(nitro: Nitro) {
  const { transformSync } = await import("rolldown/utils");
  const responseSchemas = createRouteResponseSchemaGenerator(nitro);
  return {
    name: "nitro:route-meta",
    watchChange(id) {
      responseSchemas.invalidate(id);
    },
    closeBundle() {
      responseSchemas.close();
    },
    resolveId: {
      order: "pre",
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
      order: "pre",
      filter: {
        id: new RegExp(`^${escapeRegExp(PREFIX)}`),
      },
      handler(id) {
        if (id.startsWith(PREFIX)) {
          const fullPath = id.slice(PREFIX.length);
          if (isAbsolute(fullPath)) {
            this.addWatchFile(fullPath);
            return readFile(fullPath, { encoding: "utf8" });
          } else {
            return "export const routeSchema = {}; export default undefined;";
          }
        }
      },
    },
    transform: {
      order: "pre",
      filter: {
        id: new RegExp(`^${escapeRegExp(PREFIX)}`),
      },
      async handler(code, id) {
        let meta: NitroEventHandler["meta"] | null = null;
        let hasValidation = false;

        try {
          const transformRes = transformSync(id, code, { tsconfig: false });
          if (transformRes.errors?.length > 0) {
            for (const error of transformRes.errors) {
              this.warn(error);
            }
            return {
              code: `export const routeSchema = {}; export default {};`,
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
            }
            if (
              node.type === "ExportDefaultDeclaration" &&
              node.declaration.type === "CallExpression" &&
              node.declaration.callee.type === "Identifier" &&
              node.declaration.callee.name === "defineValidatedHandler"
            ) {
              hasValidation = true;
            }
          }
        } catch (error) {
          nitro.logger.warn(`[handlers-meta] Cannot extract route meta for: ${id}: ${error}`);
        }

        const fullPath = id.slice(PREFIX.length);
        const response = isAbsolute(fullPath) ? await responseSchemas.infer(fullPath) : undefined;
        return {
          code: `export const routeSchema = {
  request: ${
    hasValidation
      ? `() => import(${JSON.stringify(fullPath)}).then((module) => module.default.validate)`
      : "undefined"
  },
  response: ${JSON.stringify(response)}
};
export default ${JSON.stringify(meta)};`,
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
