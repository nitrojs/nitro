import type { Nitro } from "nitro/types";

export default function services(nitro: Nitro) {
  return {
    id: "#nitro/virtual/services",
    template: () => servicesTemplate(nitro),
  };
}

export function servicesTemplate(nitro: Nitro): string {
  const names = Object.keys(nitro.options.services);
  const loader = nitro._serviceLoader;
  if (!loader) {
    return `export const services = {};`;
  }

  const entries = names.map((name) => {
    const key = JSON.stringify(name);
    const service = loader(name);
    return "expression" in service
      ? `  get [${key}]() { return ${service.expression} }`
      : `  [${key}]: lazyService(${key}, () => import(${JSON.stringify(service.import)}))`;
  });

  return /* js */ `
function lazyService(name, loader) {
  let promise, mod
  return {
    fetch(req) {
      if (mod) { return mod.fetch(req) }
      if (!promise) {
        promise = loader().then(_mod => {
          const m = typeof _mod.default?.fetch === "function" ? _mod.default : _mod
          if (typeof m.fetch !== "function") {
            throw new TypeError(\`[nitro] Service "\${name}" entry does not export a \\\`fetch\\\` handler.\`)
          }
          return (mod = m)
        })
      }
      return promise.then(mod => mod.fetch(req))
    }
  }
}

export const services = {
${entries.join(",\n")}
};
`;
}
