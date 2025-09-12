import type { Nitro } from "nitro/types";
import { virtual } from "./virtual";

export function handlers(nitro: Nitro) {
  return virtual(
    {
      "#nitro-internal-virtual/server-handlers": () => {
        const { handlers, uniqueHandlers } = getHandlers(nitro);

        const code = /* js */ `
import { lazyEventHandler } from "h3";

${uniqueHandlers
  .filter((h) => !h.lazy)
  .map((h) => /* js */ `import ${h._id} from "${h.handler}";`)
  .join("\n")}

${uniqueHandlers
  .filter((h) => h.lazy)
  .map(
    (h) =>
      /* js */ `const ${h._id} = lazyEventHandler(() => import("${h.handler}"));`
  )
  .join("\n")}

export const findRoute = ${nitro.routing.handlers.compileToString()}
  `.trim();
        return code;
      },
      "#nitro-internal-virtual/server-handlers-meta": () => {
        const { handlers, uniqueHandlers } = getHandlers(nitro);

        return /* js */ `
  ${uniqueHandlers
    .map((h) => /* js */ `import ${h._id}Meta from "${h.handler}?meta";`)
    .join("\n")}
export const handlersMeta = [
  ${handlers
    .map(
      (h) =>
        /* js */ `{ route: ${JSON.stringify(h.route)}, method: ${JSON.stringify(
          h.method?.toLowerCase()
        )}, meta: ${h._id}Meta }`
    )
    .join(",\n")}
  ];
        `;
      },
    },
    nitro.vfs
  );
}

function getHandlers(nitro: Nitro) {
  const handlers = Object.values(nitro.routing.handlers.routes).map(
    (h) => h.data
  );
  // Unique by import path
  const uniqueHandlers = uniqueBy(handlers, "handler");

  return {
    handlers,
    uniqueHandlers,
  };
}

function uniqueBy<T>(arr: T[], key: keyof T): T[] {
  return [...new Map(arr.map((item) => [item[key], item])).values()];
}
