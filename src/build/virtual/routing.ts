import type { Nitro, NitroEventHandler, NitroRouteRules } from "nitro/types";

export const RuntimeRouteRules = ["headers", "redirect", "proxy", "cache"] as string[];

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

      return /* js */ `
import * as __routeRules__ from "#nitro/runtime/route-rules";
import * as srvxNode from "srvx/node"
import * as h3 from "h3";

export const findRouteRules = ${nitro.routing.routeRules.compileToString({ serialize: serializeRouteRule, matchAll: true })}

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

export const findRoute = ${nitro.routing.routes.compileToString({ serialize: serializeHandler })}

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

function serializeHandler(h: MaybeArray<NitroEventHandler & { _importHash: string }>): string {
  const meta = Array.isArray(h) ? h[0] : h;

  return `{${[
    `route:${JSON.stringify(meta.route)}`,
    meta.method && `method:${JSON.stringify(meta.method)}`,
    meta.meta && `meta:${JSON.stringify(meta.meta)}`,
    `handler:${
      Array.isArray(h)
        ? `multiHandler(${h.map((handler) => serializeHandlerFn(handler)).join(",")})`
        : serializeHandlerFn(h)
    }`,
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

function serializeRouteRule(h: NitroRouteRules & { _route: string }): string {
  return `[${Object.entries(h)
    .filter(([name, options]) => options !== undefined && name[0] !== "_")
    .map(([name, options]) => {
      return `{${[
        `name:${JSON.stringify(name)}`,
        `route:${JSON.stringify(h._route)}`,
        h._method && `method:${JSON.stringify(h._method)}`,
        RuntimeRouteRules.includes(name) && `handler:__routeRules__.${name}`,
        `options:${JSON.stringify(options)}`,
      ]
        .filter(Boolean)
        .join(",")}}`;
    })
    .join(",")}]`;
}
