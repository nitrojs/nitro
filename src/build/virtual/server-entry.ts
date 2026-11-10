import type { Nitro } from "nitro/types";

import { readFile } from "node:fs/promises";
import { importOXC } from "../../utils/oxc.ts";

export default function serverEntry(nitro: Nitro) {
  return {
    id: "#nitro/virtual/server-entry",
    template: async () => {
      const entry = nitro.options.serverEntry;
      const builtinExports = _builtinWorkerExports(nitro);
      if (!entry || !entry.handler || entry.format === "node") {
        return /* js */ `${builtinExports}
export const serverEntryOptions = {};
export const serverEntryExports = {};`;
      }
      if (!(await hasServerEntryDefaultExport(nitro))) {
        return /* js */ `${builtinExports}
import * as serverEntryExports from "${entry.handler}";
export { serverEntryExports };
export const serverEntryOptions = {};`;
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

/**
 * Whether the server entry has a default export. It is optional: an entry can be used for
 * startup logic only. Unknown cases (unreadable or invalid source) are assumed to have one,
 * so that the bundler reports them.
 */
export async function hasServerEntryDefaultExport(nitro: Nitro): Promise<boolean> {
  const handler = nitro.options.serverEntry && nitro.options.serverEntry.handler;
  if (!handler) {
    return false;
  }
  const code = await readFile(handler, "utf8").catch(() => undefined);
  if (code === undefined) {
    return true;
  }
  if (!code.includes("default")) {
    return false;
  }
  const { parseSync } = await importOXC({
    dir: nitro.options.rootDir,
    paths: nitro.options.deps?.paths,
  });
  const { module, errors } = parseSync(handler, code);
  if (errors.length > 0) {
    return true;
  }
  return module.staticExports.some((e) =>
    e.entries.some(
      (entry) => entry.exportName.kind === "Default" || entry.exportName.name === "default"
    )
  );
}

// Worker exports a preset registers for Vite dev (e.g. the cloudflare `$DurableObject` class),
// merged into the Worker exports of the miniflare runner by `vite/dev-entry.mjs`
const DEV_WORKER_EXPORTS_ID = "#nitro/virtual/dev-worker-exports";

function _builtinWorkerExports(nitro: Nitro): string {
  return DEV_WORKER_EXPORTS_ID in nitro.options.virtual
    ? `export * as builtinWorkerExports from "${DEV_WORKER_EXPORTS_ID}";`
    : "export const builtinWorkerExports = {};";
}
