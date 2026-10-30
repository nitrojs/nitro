import { withBase } from "ufo";

// Polls for about 10 s, long enough for a large dev worker to reload after the fix.
const RETRY_DELAYS = [0, 100, 200, 400, 800, 1600, 3200, 3200];

/** Reloads the error page once the server renders it again, since it loads no client modules. */
export async function withDevErrorRecovery(res: Response, viteBase: string): Promise<Response> {
  const viteClient = withBase("/@vite/client", viteBase);
  const html = await res.text();
  const headers = new Headers(res.headers);
  headers.delete("content-length");
  const script = _recoveryScript(viteClient);
  const end = html.lastIndexOf("</body>");
  const body = end === -1 ? html + script : html.slice(0, end) + script + html.slice(end);
  return new Response(body, { status: res.status, statusText: res.statusText, headers });
}

export function isRecoverableDevErrorPage(method: string | undefined, res: Response): boolean {
  return (
    method === "GET" &&
    res.status >= 500 &&
    !res.headers.has("content-encoding") &&
    /^text\/html\b/i.test(res.headers.get("content-type") || "")
  );
}

function _recoveryScript(viteClient: string): string {
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
