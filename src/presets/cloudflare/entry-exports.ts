import type { Nitro } from "nitro/types";

// Named exports of the server entry (e.g. Durable Objects) are Worker exports
export function setupEntryExports(nitro: Nitro) {
  const serverEntry = serverEntryHandler(nitro);
  if (!serverEntry) return;

  const originalEntry = nitro.options.entry;
  const virtualEntryId = (nitro.options.entry = "#nitro/virtual/cloudflare-server-entry");
  nitro.options.virtual[virtualEntryId] = /* js */ `
    export * from ${JSON.stringify(serverEntry)};
    export * from ${JSON.stringify(originalEntry)};
    export { default } from ${JSON.stringify(originalEntry)};
  `;
}

export function serverEntryHandler(nitro: Nitro): string | undefined {
  return (nitro.options.serverEntry && nitro.options.serverEntry.handler) || undefined;
}
