import type { DevReloadSignal } from "./_reload-signal.ts";
import { joinURL } from "ufo";
import { DEV_RELOAD_ROUTE } from "./_reload-signal.ts";

// The page request itself waits for the dev worker to re-import changed modules.
const RETRY_DELAYS = [0, 250, 1000];
// Without Web Locks, each tab checks at this interval instead of holding a connection.
const CHECK_INTERVAL = 2000;

export interface DevErrorRecoveryOptions {
  /** URL of the dev reload route (see `DevReloadSignal`). */
  url: string;
  /** Dev server instance id. */
  id: string;
  /** Server generation the page was rendered with. */
  v: number;
  /** Check that the page renders again before reloading, for servers that reload lazily (Vite). */
  poll?: boolean;
}

/**
 * Make an HTML error page (5xx) served to a page load reload itself once the server reloads.
 *
 * @param opts.base Public base of the dev app routes.
 * @param opts.poll Check that the page renders again before reloading (servers that reload lazily).
 */
export function withDevErrorRecovery(
  req: Request,
  res: Response,
  opts: { signal: DevReloadSignal; base: string; poll?: boolean }
): Response {
  if (!isRecoverableDevErrorPage(req.method, res) || !isDocumentRequest(req.headers)) {
    return res;
  }
  return appendDevErrorRecovery(res, {
    url: joinURL(opts.base, DEV_RELOAD_ROUTE),
    id: opts.signal.id,
    v: opts.signal.generation,
    poll: opts.poll,
  });
}

/** Reloads the error page once the server reloads, since it loads no client modules. */
export function appendDevErrorRecovery(res: Response, opts: DevErrorRecoveryOptions): Response {
  const script = new TextEncoder().encode(devErrorRecoveryScript(opts));
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

/** Only page loads get the script: `fetch()` callers may insert the HTML and run its scripts. */
export function isDocumentRequest(headers: Headers): boolean {
  const dest = headers.get("sec-fetch-dest");
  if (dest) {
    return /^(?:document|iframe|frame)$/.test(dest);
  }
  return /\btext\/html\b/i.test(headers.get("accept") || "");
}

export function devErrorRecoveryScript(opts: DevErrorRecoveryOptions): string {
  // Escaped to ASCII: the page may declare another charset, and `</script>` must not end the tag
  const state = JSON.stringify({ url: opts.url, id: opts.id, v: opts.v }).replace(
    /[<\u007f-\uffff]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`
  );
  return /* js */ `<script type="module">
// Pages that load client modules of their own (hydrated framework error pages) recover through them.
if (!document.querySelector("script[type=module][src]")) {
  const state = ${state};
  const page = location.href;
  let done = false;
  const stopped = () => done || location.href !== page;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function rendersAgain(next) {
    for (const delay of ${JSON.stringify(RETRY_DELAYS)}) {
      // A newer server update starts the checks again
      await new Promise((r) => setTimeout((wake = r), delay));
      if (stopped() || latest !== next) return false;
      const res = await fetch(page, {
        cache: "no-store",
        headers: { accept: "text/html" },
        signal: AbortSignal.timeout?.(5000),
      }).catch(() => {});
      res?.body?.cancel().catch(() => {});
      if (res && res.status < 500) return true;
    }
    return false;
  }
  // A restarted dev server has a new id.
  const isNews = (next) => next.id !== state.id || next.v > state.v;
  let seen = state.v;
  let wake = () => {};
  let latest;
  let handling;
  let controller;
  function onAnswer(next) {
    if (typeof next?.id !== "string") return;
    if (next.id === state.id && next.v <= seen) return;
    if (next.id === state.id) seen = next.v;
    latest = next;
    wake();
    handling ||= (async () => {
      while (!stopped() && isNews(latest)) {
        const next = latest;
        // Reloads synchronously unless it checks the page, so the waiting tab stops right away
        if (next.id !== state.id || ${opts.poll ? "(await rendersAgain(next))" : "true"}) {
          if (!stopped()) location.reload();
          done = true;
          controller?.abort();
          return;
        }
        state.v = next.v;
      }
    })().finally(() => (handling = undefined));
  }
  // Scoped to the route, for apps served on one origin through a proxy
  const name = "nitro:dev-reload:" + state.url;
  const channel = typeof BroadcastChannel === "function" ? new BroadcastChannel(name) : undefined;
  channel?.addEventListener("message", (event) => onAnswer(event.data));
  // Asks for the server state, at once or (with \`v\`) once the server is past generation \`v\`.
  async function wait(v) {
    let failures = 0;
    while (!stopped()) {
      controller = new AbortController();
      const query = v === undefined ? "" : \`&v=\${v()}\`;
      const res = await fetch(\`\${state.url}?id=\${state.id}\${query}\`, {
        cache: "no-store",
        signal: controller.signal,
      }).catch(() => {});
      if (stopped()) return;
      // The dev server is down or closing: wait for it to answer again.
      if (!res || res.status >= 500) {
        await sleep(Math.min(250 * 2 ** failures++, 5000));
        continue;
      }
      failures = 0;
      if (res.status === 204) continue;
      if (res.status !== 200) return (done = true);
      const next = await res.json().catch(() => {});
      // Something else answers the route (e.g. a proxy fallback page)
      if (typeof next?.id !== "string") return (done = true);
      channel?.postMessage(next);
      onAnswer(next);
      if (!v) return;
    }
  }
  const locks = navigator.locks;
  if (locks) {
    // One tab per origin waits on the route and tells the others: browsers allow about 6
    // connections per origin over HTTP/1.1. Each tab checks once first, in case it missed an update.
    wait();
    await locks.request(name, () => wait(() => seen));
  } else {
    // Without Web Locks (insecure origins), visible tabs check at an interval instead.
    while (!stopped()) {
      if (!document.hidden) await wait();
      await sleep(${CHECK_INTERVAL});
    }
  }
}
</script>`;
}
