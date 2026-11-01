import type { IncomingHttpHeaders } from "node:http";
import { withBase } from "ufo";

// Polls for about 10 s, long enough for a large dev worker to reload after the fix.
const RETRY_DELAYS = [0, 100, 200, 400, 800, 1600, 3200, 3200];

/** Reloads the error page once the server renders it again, since it loads no client modules. */
export function withDevErrorRecovery(res: Response, viteBase: string): Response {
  const script = new TextEncoder().encode(
    devErrorRecoveryScript(withBase("/@vite/client", viteBase))
  );
  const headers = new Headers(res.headers);
  headers.delete("content-length");
  // Appended once the page ends so a streamed body is forwarded as it arrives.
  const body = (res.body || new Blob([]).stream()).pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      flush(controller) {
        controller.enqueue(script);
      },
    })
  );
  return new Response(body, { status: res.status, statusText: res.statusText, headers });
}

export function isRecoverableDevErrorPage(method: string | undefined, res: Response): boolean {
  // Checked first: reading `res.headers` makes srvx copy (and reorder) them on every response.
  if (method !== "GET" || res.status < 500) {
    return false;
  }
  const contentType = res.headers.get("content-type") || "";
  return (
    !res.headers.has("content-encoding") &&
    /^text\/html\b/i.test(contentType) &&
    // The script is ASCII, so it can be appended to any ASCII-compatible encoding.
    !/charset\s*=\s*"?utf-?(?:16|32)/i.test(contentType)
  );
}

/** Only page loads get the script (as in the middleware): `fetch()` callers may insert the HTML and run its scripts. */
export function isDocumentRequest(headers: IncomingHttpHeaders): boolean {
  const dest = headers["sec-fetch-dest"];
  if (typeof dest === "string" && dest) {
    return /^(?:document|iframe|frame)$/.test(dest);
  }
  return /\btext\/html\b/i.test(headers.accept || "");
}

export function devErrorRecoveryScript(viteClient: string): string {
  return /* js */ `<script type="module">
// Pages that load client modules of their own (hydrated framework error pages) recover through them.
if (!document.querySelector("script[type=module][src]")) {
  const { createHotContext } = await import(${JSON.stringify(viteClient)});
  const hot = createHotContext("/@nitro/dev-error-page");
  const url = location.href;
  let pending = false;
  let done = false;
  const stopped = () => done || location.href !== url;
  async function reloadWhenRecovered() {
    if (pending || stopped()) return;
    pending = true;
    for (const delay of ${JSON.stringify(RETRY_DELAYS)}) {
      await new Promise((r) => setTimeout(r, delay));
      if (stopped()) return;
      const res = await fetch(url, {
        cache: "no-store",
        headers: { accept: "text/html" },
        signal: AbortSignal.timeout(5000),
      }).catch(() => {});
      if (stopped()) return;
      if (res && res.status < 500) {
        done = true;
        return location.reload();
      }
    }
    pending = false;
  }
  // Vite reloads the page itself on a full reload that names no HTML file.
  hot.on("vite:beforeFullReload", (payload) => {
    if (!payload?.path?.endsWith(".html")) done = true;
  });
  // Vite awaits listeners before handling the next HMR message, so do not return the promise.
  hot.on("nitro:server-update", () => void reloadWhenRecovered());
}
</script>`;
}
