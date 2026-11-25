import type { Nitro, NitroModule } from "nitro/types";

export interface ScanResolvedCall {
  /** Files of the scanned handlers (middleware and routes). */
  handlers: string[];
  /** `route method` of the scanned routes. */
  scanned: string[];
  /** `route method` of the routes from scanned files in `nitro.routing`. */
  routed: string[];
}

/**
 * A module deriving an artifact from each `scan:resolved` call, the way route type generators,
 * OpenAPI path lists or route manifests do.
 */
export function scanResolvedRecorder() {
  const calls: ScanResolvedCall[] = [];
  let nitro: Nitro | undefined;
  const module: NitroModule = {
    name: "scan-resolved-recorder",
    setup(_nitro) {
      nitro = _nitro;
      nitro.hooks.hook("scan:resolved", (nitro) => {
        calls.push(snapshotScan(nitro));
      });
    },
  };
  return {
    module,
    calls,
    current: () => snapshotScan(nitro!),
  };
}

export function snapshotScan(nitro: Nitro): ScanResolvedCall {
  const files = new Set(nitro.scannedHandlers.map((h) => h.handler));
  return {
    handlers: [...files].sort(),
    scanned: nitro.scannedHandlers
      .filter((h) => !h.middleware && !h.ws)
      .map(routeKey)
      .sort(),
    routed: nitro.routing.routes.routes
      .filter((r) => [r.data].flat().some((h) => files.has(h.handler)))
      .map(routeKey)
      .sort(),
  };
}

function routeKey(h: { route?: string; method?: string }) {
  return `${h.route} ${h.method || "*"}`;
}
