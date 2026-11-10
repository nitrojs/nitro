import { HTTPError, defineHandler } from "h3";
import type { EventHandler } from "h3";

// Public asset dirs without fallthrough when assets are served by the platform (`serveStatic: false`):
// a request reaching the server is for a missing file. Opts it out of the immutable `cache-control`
// route rule of asset dirs (h3js/h3#1612), as `static.ts` does when Nitro serves them.
export default defineHandler(() => {
  throw new HTTPError({ status: 404, headers: { "cache-control": "no-store" } });
}) as EventHandler;
