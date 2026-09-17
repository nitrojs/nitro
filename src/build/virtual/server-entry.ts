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
const { fetch: _fetch, manual: _manual, ...serverEntryOptions } = proto === Object.prototype || proto === null ? serverEntry : {};
export { serverEntryOptions };
`;
    },
  };
}
