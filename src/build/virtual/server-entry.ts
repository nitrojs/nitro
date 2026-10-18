import type { Nitro } from "nitro/types";

export default function serverEntry(nitro: Nitro) {
  return {
    id: "#nitro/virtual/server-entry",
    template: () => {
      const entry = nitro.options.serverEntry;
      const builtinExports = _builtinWorkerExports(nitro);
      if (!entry || !entry.handler || entry.format === "node") {
        return /* js */ `${builtinExports}
export const serverEntryOptions = {};
export const serverEntryExports = {};`;
      }
      return /* js */ `${builtinExports}
import serverEntry from "${entry.handler}";
import * as serverEntryExports from "${entry.handler}";
export { serverEntryExports };
const proto = serverEntry && Object.getPrototypeOf(serverEntry);
const allowedKeys = new Set(["port", "hostname", "reusePort", "protocol", "tls", "silent", "gracefulShutdown", "maxRequestBodySize", "trustProxy", "node", "bun", "deno"]);
export const serverEntryOptions = {};
if (proto === Object.prototype || proto === null) {
  for (const key in serverEntry) {
    if (allowedKeys.has(key)) {
      serverEntryOptions[key] = serverEntry[key];
    }
  }
}
`;
    },
  };
}

// Worker exports a preset registers for Vite dev (e.g. the cloudflare `$DurableObject` class),
// merged into the Worker exports of the miniflare runner by `vite/dev-entry.mjs`
const DEV_WORKER_EXPORTS_ID = "#nitro/virtual/dev-worker-exports";

function _builtinWorkerExports(nitro: Nitro): string {
  return DEV_WORKER_EXPORTS_ID in nitro.options.virtual
    ? `export * as builtinWorkerExports from "${DEV_WORKER_EXPORTS_ID}";`
    : "export const builtinWorkerExports = {};";
}
