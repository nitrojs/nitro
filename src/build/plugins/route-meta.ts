import { readFile } from "node:fs/promises";
import { isAbsolute } from "pathe";
import type { Expression, Literal } from "estree";
import type { Nitro, NitroEventHandler } from "nitro/types";
import type { Plugin } from "rollup";
import type { Plugin as VitePlugin } from "vite";
import { escapeRegExp } from "../../utils/regex.ts";
import { createRouteResponseSchemaGenerator } from "./_route-response-schema.ts";
import { extractRouteValidation } from "./_route-request-schema.ts";

const PREFIX = "\0nitro:route-meta:";

export async function routeMeta(nitro: Nitro) {
  const { transformSync } = await import("rolldown/utils");
  const responseSchemas = createRouteResponseSchemaGenerator(nitro);
  const virtualIds = new Set<string>();
  return {
    name: "nitro:route-meta",
    watchChange(id) {
      responseSchemas.invalidate(id);
    },
    hotUpdate: {
      order: "pre",
      handler({ file, modules, timestamp }) {
        responseSchemas.invalidate(file);
        const updated = new Set(modules);
        for (const id of virtualIds) {
          const module = this.environment.moduleGraph.getModuleById(id);
          if (module) {
            this.environment.moduleGraph.invalidateModule(module, undefined, timestamp, true);
            updated.add(module);
          }
        }
        return [...updated];
      },
    },
    closeBundle() {
      responseSchemas.close();
    },
    resolveId: {
      order: "pre",
      async handler(id, importer, resolveOpts) {
        if (!id.startsWith("\0") && (id.endsWith("?meta") || id.endsWith("?nitro-validation"))) {
          const validation = id.endsWith("?nitro-validation");
          const resolved = await this.resolve(
            id.replace(/\?(meta|nitro-validation)$/, ""),
            importer,
            resolveOpts
          );
          if (!resolved) {
            return;
          }
          return PREFIX + resolved.id + (validation ? "?nitro-validation" : "");
        }
        if (importer?.startsWith(PREFIX) && importer.endsWith("?nitro-validation")) {
          return this.resolve(
            id,
            importer.slice(PREFIX.length).replace(/\?nitro-validation$/, ""),
            resolveOpts
          );
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
          virtualIds.add(id);
          const fullPath = id.slice(PREFIX.length).replace(/\?nitro-validation$/, "");
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
        const validation = id.endsWith("?nitro-validation");
        let meta: NitroEventHandler["meta"] | null = null;
        let hasValidation = false;

        try {
          const transformRes = transformSync(id.replace(/\?nitro-validation$/, ""), code, {
            tsconfig: false,
          });
          if (transformRes.errors?.length > 0) {
            for (const error of transformRes.errors) {
              this.warn(error);
            }
            return {
              code: validation
                ? "export default undefined;"
                : `export const routeSchema = {}; export default {};`,
              map: null,
            };
          }

          const ast = this.parse(transformRes.code);
          if (validation) {
            return { code: await extractRouteValidation(transformRes.code, { ast }), map: null };
          }
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
          if (validation) {
            return { code: "export default undefined;", map: null };
          }
        }

        const fullPath = id.slice(PREFIX.length);
        const response = isAbsolute(fullPath) ? await responseSchemas.infer(fullPath) : undefined;
        return {
          code: `export const routeSchema = {
  request: ${
    hasValidation
      ? `() => import(${JSON.stringify(fullPath + "?nitro-validation")}).then((module) => module.default)`
      : "undefined"
  },
  response: ${JSON.stringify(response)}
};
export default ${JSON.stringify(meta)};`,
          map: null,
        };
      },
    },
  } satisfies Plugin & Pick<VitePlugin, "hotUpdate">;
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
