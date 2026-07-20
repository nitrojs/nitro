import type { Nitro } from "nitro/types";

export default function routingMeta(nitro: Nitro) {
  return {
    id: "#nitro/virtual/routing-meta",
    template: () => {
      const handlers = Object.values(nitro.routing.routes.routes).flatMap((h) => h.data);
      const routeHandlers = uniqueBy(handlers, "_importHash");

      return /* js */ `
  ${routeHandlers
    .map((h) => /* js */ `import ${h._importHash}Meta from "${h.handler}?meta";`)
    .join("\n")}
export const handlersMeta = [
  ${handlers
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
  };
}

function uniqueBy<T>(arr: T[], key: keyof T): T[] {
  return [...new Map(arr.map((item) => [item[key], item])).values()];
}
