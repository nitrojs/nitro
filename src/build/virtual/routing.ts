import type { Nitro, NitroEventHandler } from "nitro/types";
import { compileRouteRules } from "h3-rules/compiler";

export default function routing(nitro: Nitro) {
  return {
    id: "#nitro/virtual/routing",
    template: () => {
      const allHandlers = uniqueBy(
        [
          ...Object.values(nitro.routing.routes.routes).flatMap((h) => h.data),
          ...Object.values(nitro.routing.routedMiddleware.routes).map((h) => h.data),
          ...nitro.routing.globalMiddleware,
        ],
        "_importHash"
      );

      const traceH3 = !!nitro.options.tracingChannel?.h3;

      const routeRulesModule = compileRouteRules(nitro.options.routeRules, {
        runtimeRules: { cache: "#nitro/runtime/route-rule-handlers" },
        baseURL: nitro.options.baseURL,
        preMerge: true,
      });

      return /* js */ `
import * as srvxNode from "srvx/node"
import * as h3 from "h3";${traceH3 ? `\nimport { wrapHandlerWithTracing } from "h3/tracing";` : ""}

${routeRulesModule}
const multiHandler = (...handlers) => {
  const final = handlers.pop()
  const middleware = handlers.filter(Boolean).map(h => h3.toMiddleware(h));
  return (ev) => h3.callMiddleware(ev, middleware, final);
}

${allHandlers
  .filter((h) => !h.lazy)
  .map((h) => /* js */ `import ${h._importHash} from "${h.handler}";`)
  .join("\n")}

${allHandlers
  .filter((h) => h.lazy)
  .map(
    (h) =>
      /* js */ `const ${h._importHash} = h3.defineLazyEventHandler(() => import("${h.handler}")${h.format === "node" ? ".then(m => srvxNode.toFetchHandler(m.default))" : ""});`
  )
  .join("\n")}

export const findRoute = ${nitro.routing.routes.compileToString({ serialize: (h) => serializeHandler(h, { tracing: traceH3 }) })}

export const findRoutedMiddleware = ${nitro.routing.routedMiddleware.compileToString({ serialize: serializeHandler, matchAll: true })};

export const globalMiddleware = [
  ${nitro.routing.globalMiddleware.map((h) => (h.lazy ? h._importHash : `h3.toEventHandler(${h._importHash})`)).join(",")}
].filter(Boolean);
  `;
    },
  };
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
      code = `srvxNode.toFetchHandler(${code})`;
    }
    code = `h3.toEventHandler(${code})`;
  }
  return code;
}
