import type { Nitro } from "nitro/types";
import { virtual } from "./virtual";

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
          "_importName"
        );

        return /* js */ `
import * as __routeRules__ from 'nitro/runtime/internal/route-rules';
import { lazyEventHandler } from "h3";

export const findRouteRules = ${nitro.routing.routeRules.compileToString()}

${allHandlers
  .filter((h) => !h.lazy)
  .map((h) => /* js */ `import ${h._importName} from "${h.handler}";`)
  .join("\n")}

${allHandlers
  .filter((h) => h.lazy)
  .map(
    (h) =>
      /* js */ `const ${h._importName} = lazyEventHandler(() => import("${h.handler}"));`
  )
  .join("\n")}

export const findRoute = ${nitro.routing.routes.compileToString()}

export const middleware = [${nitro.routing.middleware.map((mw) => mw.toJSON()).join(",")}];
  `;
      },
      // --- routing-meta ---
      "#nitro-internal-virtual/routing-meta": () => {
        const routeHandlers = uniqueBy(
          Object.values(nitro.routing.routes.routes).map((h) => h.data),
          "_importName"
        );

        return /* js */ `
  ${routeHandlers
    .map(
      (h) => /* js */ `import ${h._importName}Meta from "${h.handler}?meta";`
    )
    .join("\n")}
export const handlersMeta = [
  ${routeHandlers
    .map(
      (h) =>
        /* js */ `{ route: ${JSON.stringify(h.route)}, method: ${JSON.stringify(
          h.method?.toLowerCase()
        )}, meta: ${h._importName}Meta }`
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
