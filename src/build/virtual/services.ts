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

  let unbundled = false;
  const entries = names.map((name) => {
    const key = JSON.stringify(name);
    const service = loader(name);
    if ("expression" in service) {
      return `  get [${key}]() { return ${service.expression} }`;
    }
    const id = JSON.stringify(service.import);
    unbundled ||= service.bundle === false;
    return `  [${key}]: lazyService(${key}, () => ${service.bundle === false ? `importUnbundled(${id})` : `import(${id})`})`;
  });

  // A non-literal specifier is not bundled
  const importUnbundled = /* js */ `
function importUnbundled(id) {
  return import(/* webpackIgnore: true */ /* @vite-ignore */ id)
}`;

  return /* js */ `${unbundled ? importUnbundled : ""}
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
        }).catch(error => {
          // Retried by the next fetch (e.g. after the output is rebuilt)
          promise = undefined
          throw error
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
