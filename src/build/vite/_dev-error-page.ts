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
  const contentType = res.headers.get("content-type") || "";
  return (
    method === "GET" &&
    res.status >= 500 &&
    !res.headers.has("content-encoding") &&
    /^text\/html\b/i.test(contentType) &&
    // The script is ASCII, so it can be appended to any ASCII-compatible encoding.
    !/charset\s*=\s*"?utf-?(?:16|32)/i.test(contentType)
  );
}

export function devErrorRecoveryScript(viteClient: string): string {
  return /* js */ `<script type="module">
import { createHotContext } from ${JSON.stringify(viteClient)};
const hot = createHotContext("/@nitro/dev-error-page");
let pending = false;
async function reloadWhenRecovered() {
  if (pending) return;
  pending = true;
  for (const delay of ${JSON.stringify(RETRY_DELAYS)}) {
    await new Promise((r) => setTimeout(r, delay));
    const res = await fetch(location.href, {
      cache: "no-store",
      headers: { accept: "text/html" },
      signal: AbortSignal.timeout(5000),
    }).catch(() => {});
    if (res && res.status < 500) return location.reload();
  }
  pending = false;
}
// Vite awaits listeners before handling the next HMR message, so do not return the promise.
hot.on("vite:beforeUpdate", () => void reloadWhenRecovered());
hot.on("nitro:server-update", () => void reloadWhenRecovered());
</script>`;
}
