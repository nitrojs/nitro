import type { Nitro } from "nitro/types";

export default function serverEntry(nitro: Nitro) {
  return {
    id: "#nitro/virtual/server-entry",
    template: () => {
      const entry = nitro.options.serverEntry;
      if (!entry || !entry.handler || entry.format === "node") {
        return /* js */ `export const serverEntryOptions = {};`;
      }
      return /* js */ `
import serverEntry from "${entry.handler}";
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
