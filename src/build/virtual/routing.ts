import type { Nitro, NitroEventHandler } from "nitro/types";
import { compileRouteRules } from "h3/rules/compiler";
import { hasServerEntryDefaultExport } from "./server-entry.ts";

export default function routing(nitro: Nitro) {
  return {
    id: "#nitro/virtual/routing",
    template: async () => {
      const handlers = [
        ...Object.values(nitro.routing.routes.routes).flatMap((h) => h.data),
        ...Object.values(nitro.routing.routedMiddleware.routes).map((h) => h.data),
        ...nitro.routing.globalMiddleware,
      ];
      const allHandlers = uniqueBy(handlers, "_importHash");

      const traceH3 = !!nitro.options.tracingChannel?.h3;

      // Not imported otherwise: bundlers can keep the builtins it imports (e.g. Bun).
      // Checked before deduplication: the same handler can be registered with another format
      const hasNodeHandlers = handlers.some((h) => h.format === "node");

      const serverEntry = nitro.options.serverEntry;
      const webServerEntry =
        serverEntry && serverEntry.handler && serverEntry.format !== "node"
          ? serverEntry.handler.replace(/\\/g, "/")
          : undefined;
      const serverEntryHasDefault = !!webServerEntry && (await hasServerEntryDefaultExport(nitro));

      const routeRulesModule = compileRouteRules(nitro.options.routeRules, {
        runtimeRules: { cache: "#nitro/runtime/route-rule-handlers" },
        baseURL: nitro.options.baseURL,
        preMerge: true,
      });

      return /* js */ `${hasNodeHandlers ? `\nimport * as srvxNode from "srvx/node"` : ""}
import * as h3 from "h3";${traceH3 ? `\nimport { wrapHandlerWithTracing } from "h3/tracing";` : ""}

${routeRulesModule}
const multiHandler = (...handlers) => {
  const final = handlers.pop()
  const middleware = handlers.filter(Boolean).map(h => h3.toMiddleware(h));
  return (ev) => h3.callMiddleware(ev, middleware, final);
}

${allHandlers
  .filter((h) => !h.lazy)
  .map((h) =>
    h.handler === webServerEntry
      ? serverEntryImport(h, serverEntryHasDefault)
      : /* js */ `import ${h._importHash} from ${JSON.stringify(h.handler)};`
  )
  .join("\n")}

${allHandlers
  .filter((h) => h.lazy)
  .map(
    (h) =>
      /* js */ `const ${h._importHash} = h3.defineLazyEventHandler(() => import(${JSON.stringify(h.handler)})${h.format === "node" ? ".then(m => ({ fetch: srvxNode.toFetchHandler(m.default) }))" : ""});`
  )
  .join("\n")}

export const findRoute = ${nitro.routing.routes.compileToString({ serialize: (h) => serializeHandler(h, { tracing: traceH3 }) })}

export const findRoutedMiddleware = ${nitro.routing.routedMiddleware.compileToString({ serialize: serializeHandlerFn, matchAll: true })};

export const globalMiddleware = [
  ${nitro.routing.globalMiddleware.map((h) => (h.lazy ? h._importHash : `h3.toEventHandler(${h._importHash})`)).join(",")}
].filter(Boolean);
  `;
    },
  };
}

// The default export (and its `fetch`) of the server entry is optional: it can be used
// for startup logic only. Without a handler, requests continue to the renderer (or 404).
function serverEntryImport(
  h: NitroEventHandler & { _importHash: string },
  hasDefault: boolean
): string {
  const notFound = `() => Symbol.for("h3.notFound")`;
  if (!hasDefault) {
    return /* js */ `import ${JSON.stringify(h.handler)};
const ${h._importHash} = ${notFound};`;
  }
  const entry = `${h._importHash}_entry`;
  return /* js */ `import ${entry} from ${JSON.stringify(h.handler)};
const ${h._importHash} = typeof ${entry} === "function" || typeof ${entry}?.fetch === "function" ? ${entry} : ${notFound};`;
}

function uniqueBy<T>(arr: T[], key: keyof T): T[] {
  return [...new Map(arr.map((item) => [item[key], item])).values()];
}

// --- Serializing ---

type MaybeArray<T> = T | T[];

function serializeHandler(
  h: MaybeArray<NitroEventHandler & { _importHash: string }>,
  opts: { tracing?: boolean } = {}
): string {
  const meta = Array.isArray(h) ? h[0] : h;
  const handler = Array.isArray(h)
    ? `multiHandler(${h.map((handler) => serializeHandlerFn(handler)).join(",")})`
    : serializeHandlerFn(h);

  return `{${[
    `route:${JSON.stringify(meta.route)}`,
    meta.method && `method:${JSON.stringify(meta.method)}`,
    meta.meta && `meta:${JSON.stringify(meta.meta)}`,
    `handler:${opts.tracing ? `wrapHandlerWithTracing(${handler})` : handler}`,
  ]
    .filter(Boolean)
    .join(",")}}`;
}

function serializeHandlerFn(h: NitroEventHandler & { _importHash: string }): string {
  let code = h._importHash;
  if (!h.lazy) {
    if (h.format === "node") {
      code = `{ fetch: srvxNode.toFetchHandler(${code}) }`;
    }
    code = `h3.toEventHandler(${code})`;
  }
  return code;
}
