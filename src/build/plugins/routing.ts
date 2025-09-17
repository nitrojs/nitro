import type { Nitro, NitroEventHandler, NitroRouteRules } from "nitro/types";
import { virtual } from "./virtual";

const RuntimeRouteRules = new Set(["headers", "redirect", "proxy"]);

export function routing(nitro: Nitro) {
  return virtual(
    {
      // --- routing (routes, routeRules and middleware) ---
      "#nitro-internal-virtual/routing": () => {
        const allHandlers = uniqueBy(
          [
            ...Object.values(nitro.routing.routes.routes).map((h) => h.data),
            ...nitro.routing.middleware,
          ],
          "_importHash"
        );

        return /* js */ `
import * as __routeRules__ from 'nitro/runtime/internal/route-rules';
${allHandlers.some((h) => h.lazy) ? `import { lazyEventHandler } from "h3";` : ""}

export const findRouteRules = ${nitro.routing.routeRules.compileToString({ serialize: serializeRouteRule, matchAll: true })}

${allHandlers
  .filter((h) => !h.lazy)
  .map((h) => /* js */ `import ${h._importHash} from "${h.handler}";`)
  .join("\n")}

${allHandlers
  .filter((h) => h.lazy)
  .map(
    (h) =>
      /* js */ `const ${h._importHash} = lazyEventHandler(() => import("${h.handler}"));`
  )
  .join("\n")}

export const findRoute = ${nitro.routing.routes.compileToString({ serialize: serializeHandler })}

export const middleware = [${nitro.routing.middleware.map((h) => serializeHandler(h)).join(",")}];
  `;
      },
      // --- routing-meta ---
      "#nitro-internal-virtual/routing-meta": () => {
        const routeHandlers = uniqueBy(
          Object.values(nitro.routing.routes.routes).map((h) => h.data),
          "_importHash"
        );

        return /* js */ `
  ${routeHandlers
    .map(
      (h) => /* js */ `import ${h._importHash}Meta from "${h.handler}?meta";`
    )
    .join("\n")}
export const handlersMeta = [
  ${routeHandlers
    .map(
      (h) =>
        /* js */ `{ route: ${JSON.stringify(h.route)}, method: ${JSON.stringify(
          h.method?.toLowerCase()
        )}, meta: ${h._importHash}Meta }`
    )
    .join(",\n")}
  ];
        `.trim();
      },
    },
    nitro.vfs
  );
}

function uniqueBy<T>(arr: T[], key: keyof T): T[] {
  return [...new Map(arr.map((item) => [item[key], item])).values()];
}

// --- Serializing ---

function serializeHandler(
  h: NitroEventHandler & { _importHash: string }
): string {
  return `{${[
    `route:${JSON.stringify(h.route)}`,
    h.method && `method:${JSON.stringify(h.method)}`,
    h.meta && `meta:${JSON.stringify(h.meta)}`,
    `handler:${h._importHash}`,
  ]
    .filter(Boolean)
    .join(",")}}`;
}

function serializeRouteRule(h: NitroRouteRules): string {
  return `[${Object.entries(h)
    .filter(([_name, options]) => options !== undefined)
    .map(([name, options]) => {
      return `{${[
        `name:${JSON.stringify(name)}`,
        RuntimeRouteRules.has(name) && `handler:__routeRules__.${name}`,
        `options:${JSON.stringify(options)}`,
      ]
        .filter(Boolean)
        .join(",")}}`;
    })
    .join(",")}]`;
}
