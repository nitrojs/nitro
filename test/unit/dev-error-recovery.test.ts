import type { H3Event } from "h3";
import { describe, expect, it, vi } from "vitest";
import {
  devErrorRecoveryScript,
  isDocumentRequest,
  appendDevErrorRecovery,
  isRecoverableDevErrorPage,
  withDevErrorRecovery,
} from "../../src/dev/_error-recovery.ts";
import { DevReloadSignal } from "../../src/dev/_reload-signal.ts";

const htmlError = (contentType = "text/html; charset=utf-8") =>
  new Response("<p>error</p>", { status: 500, headers: { "content-type": contentType } });

type Reply = { status: number; body?: unknown } | "offline";

const toResponse = (reply: Exclude<Reply, "offline">) =>
  new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
    status: reply.status,
  });

// Web Locks (granted in request order) and BroadcastChannel shared by the tabs of one browser.
function createBrowser() {
  const queue: (() => void)[] = [];
  let held = false;
  const locks = {
    async request(_name: string, cb: () => Promise<unknown>) {
      if (held) {
        await new Promise<void>((resolve) => queue.push(resolve));
      }
      held = true;
      try {
        return await cb();
      } finally {
        held = false;
        queue.shift()?.();
      }
    },
  };
  const channels = new Set<FakeBroadcastChannel>();
  class FakeBroadcastChannel {
    #listeners: ((event: { data: unknown }) => void)[] = [];
    constructor() {
      channels.add(this);
    }
    addEventListener(_type: string, cb: (event: { data: unknown }) => void) {
      this.#listeners.push(cb);
    }
    postMessage(data: unknown) {
      for (const channel of channels) {
        if (channel !== this) {
          globalThis.setTimeout(() => channel.#listeners.forEach((cb) => cb({ data })), 0);
        }
      }
    }
  }
  return { locks, BroadcastChannel: FakeBroadcastChannel };
}

// Runs the injected module with `document`, `fetch`, `location` and `navigator` stubbed.
// The route answers from `replies.route`, then waits for `answer()` (except for a first instant
// check, answered with the current state).
async function runRecoveryScript(
  replies: { route?: Reply[]; page?: number[] },
  opts: {
    poll?: boolean;
    clientModules?: boolean;
    hidden?: boolean;
    browser?: ReturnType<typeof createBrowser>;
    realDelays?: boolean;
  } = {}
) {
  const route = replies.route || [];
  const page = replies.page || [];
  const pending: ((reply: Reply) => void)[] = [];
  let checked = false;
  const location = { href: "http://localhost/page", reload: vi.fn() };
  const fetch = vi.fn(async (url: string, init?: { signal?: AbortSignal }) => {
    if (url === location.href) {
      return new Response(null, { status: page.shift() ?? 500 });
    }
    let reply = route.shift();
    if (!reply && !checked && !url.includes("&v=")) {
      checked = true;
      reply = { status: 200, body: { id: "a", v: 1 } };
    }
    if (!reply) {
      reply = await new Promise<Reply>((resolve, reject) => {
        pending.push(resolve);
        init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
      });
    }
    if (reply === "offline") {
      throw new TypeError("fetch failed");
    }
    return toResponse(reply);
  });
  const answer = (reply: Reply) => pending.shift()!(reply);
  const document = {
    hidden: !!opts.hidden,
    querySelector: () => (opts.clientModules ? {} : null),
  };
  const source = devErrorRecoveryScript({
    url: "/_nitro/dev/reload",
    id: "a",
    v: 1,
    poll: opts.poll,
  })
    .replace(/^<script type="module">/, "")
    .replace(/<\/script>$/, "");
  const AsyncFunction = (async () => {}).constructor as FunctionConstructor;
  const setTimeout = (cb: () => void, ms: number) =>
    globalThis.setTimeout(cb, opts.realDelays ? ms : 0);
  const done = new AsyncFunction(
    "document",
    "fetch",
    "location",
    "setTimeout",
    "navigator",
    "BroadcastChannel",
    source
  )(
    document,
    fetch,
    location,
    setTimeout,
    { locks: opts.browser?.locks },
    opts.browser?.BroadcastChannel
  );
  const urls = () => fetch.mock.calls.map((c) => c[0]);
  const waits = () => urls().filter((url) => url.includes("&v="));
  const pageLoads = () => urls().filter((url) => url === location.href).length;
  return { done, fetch, location, document, answer, urls, waits, pageLoads };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

const checkURL = "/_nitro/dev/reload?id=a";
const waitURL = (v: number) => `/_nitro/dev/reload?id=a&v=${v}`;

describe("dev error page recovery", () => {
  it("only rewrites GET HTML 5xx responses in an ASCII-compatible encoding", () => {
    expect(isRecoverableDevErrorPage("GET", htmlError())).toBe(true);
    expect(isRecoverableDevErrorPage("GET", htmlError("text/html; charset=iso-8859-1"))).toBe(true);
    expect(isRecoverableDevErrorPage("POST", htmlError())).toBe(false);
    expect(isRecoverableDevErrorPage("GET", htmlError("application/json"))).toBe(false);
    expect(isRecoverableDevErrorPage("GET", htmlError("text/html; charset=UTF-16LE"))).toBe(false);
    expect(
      isRecoverableDevErrorPage(
        "GET",
        new Response("", {
          status: 500,
          headers: { "content-type": "text/html", "content-encoding": "gzip" },
        })
      )
    ).toBe(false);
    expect(isRecoverableDevErrorPage("GET", new Response("", { status: 404 }))).toBe(false);
  });

  it("reads response headers only for GET 5xx responses", () => {
    const get = vi.fn(() => "text/html");
    const res = { status: 200, headers: { get, has: get } } as unknown as Response;
    expect(isRecoverableDevErrorPage("GET", res)).toBe(false);
    expect(isRecoverableDevErrorPage("POST", { ...res, status: 500 } as Response)).toBe(false);
    expect(get).not.toHaveBeenCalled();
  });

  it("only injects into page loads", () => {
    const doc = (headers: Record<string, string>) => isDocumentRequest(new Headers(headers));
    expect(doc({ "sec-fetch-dest": "document" })).toBe(true);
    expect(doc({ "sec-fetch-dest": "iframe" })).toBe(true);
    expect(doc({ "sec-fetch-dest": "frame" })).toBe(true);
    expect(doc({ "sec-fetch-dest": "empty", accept: "text/html" })).toBe(false);
    expect(doc({ accept: "text/html,application/xhtml+xml" })).toBe(true);
    expect(doc({ accept: "*/*" })).toBe(false);
    expect(doc({})).toBe(false);
  });

  it("forwards a streamed page before it ends and appends the script", async () => {
    let source!: ReadableStreamDefaultController<Uint8Array>;
    const res = new Response(new ReadableStream({ start: (c) => void (source = c) }), {
      status: 500,
      headers: { "content-type": "text/html", "content-length": "11" },
    });
    const recovered = appendDevErrorRecovery(res, {
      url: "/base/_nitro/dev/reload",
      id: "a",
      v: 3,
    });
    expect(recovered.status).toBe(500);
    expect(recovered.headers.has("content-length")).toBe(false);

    const reader = recovered.body!.getReader();
    const decoder = new TextDecoder();
    source.enqueue(new TextEncoder().encode("<p>first</p>"));
    expect(decoder.decode((await reader.read()).value)).toBe("<p>first</p>");

    source.close();
    let rest = "";
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      rest += decoder.decode(chunk.value);
    }
    expect(rest).toContain(`{"url":"/base/_nitro/dev/reload","id":"a","v":3}`);
    expect(rest.trimEnd().endsWith("</script>")).toBe(true);
  });

  it("injects into page loads with the current server state", async () => {
    const signal = new DevReloadSignal();
    signal.bump();
    const page = (headers: Record<string, string>, method = "GET") =>
      withDevErrorRecovery(new Request("http://localhost/", { method, headers }), htmlError(), {
        signal,
        base: "/app/",
      }).text();
    expect(await page({ "sec-fetch-dest": "document" })).toContain(
      JSON.stringify({ url: "/app/_nitro/dev/reload", id: signal.id, v: 1 })
    );
    expect(await page({ "sec-fetch-dest": "empty" })).toBe("<p>error</p>");
    expect(await page({ "sec-fetch-dest": "document" }, "POST")).toBe("<p>error</p>");
  });

  it("escapes the embedded state to ASCII", () => {
    const script = devErrorRecoveryScript({ url: "/</script>/ä€😀/", id: "a", v: 0 });
    expect(script.match(/<\/script>/g)).toHaveLength(1);
    expect(/^[\x00-\x7f]*$/.test(script)).toBe(true);
    const state = script.match(/const state = (\{.*?\});/)![1]!;
    expect(JSON.parse(state).url).toBe("/</script>/ä€😀/");
  });

  it("leaves pages that load their own client modules to them", async () => {
    const { done, fetch } = await runRecoveryScript({}, { clientModules: true });
    await done;
    expect(fetch).not.toHaveBeenCalled();
  });

  describe("without Web Locks", () => {
    it("checks at an interval instead of waiting on the route", async () => {
      const tab = await runRecoveryScript({});
      await vi.waitFor(() => expect(tab.urls()).toHaveLength(2));
      tab.answer({ status: 200, body: { id: "a", v: 2 } });
      await tab.done;
      expect(tab.location.reload).toHaveBeenCalledOnce();
      expect(tab.urls()).toEqual([checkURL, checkURL]);
    });

    it("does not check while hidden", async () => {
      const tab = await runRecoveryScript({}, { hidden: true });
      await tick();
      expect(tab.fetch).not.toHaveBeenCalled();
      tab.document.hidden = false;
      await vi.waitFor(() => expect(tab.fetch).toHaveBeenCalled());
    });

    it("reloads once a restarted dev server answers again", async () => {
      const tab = await runRecoveryScript(
        {
          route: ["offline", { status: 503 }, "offline", { status: 200, body: { id: "b", v: 0 } }],
        },
        { poll: true }
      );
      await tab.done;
      expect(tab.location.reload).toHaveBeenCalledOnce();
      expect(tab.pageLoads()).toBe(0);
    });

    it("stops when the route is not served", async () => {
      const tab = await runRecoveryScript({ route: [{ status: 404 }] });
      await tab.done;
      expect(tab.location.reload).not.toHaveBeenCalled();
    });

    it("stops when something else answers the route", async () => {
      const tab = await runRecoveryScript({ route: [{ status: 200, body: "<html>" }] });
      await tab.done;
      expect(tab.location.reload).not.toHaveBeenCalled();
      expect(tab.urls()).toHaveLength(1);
    });

    it("stops after a client-side navigation", async () => {
      const tab = await runRecoveryScript({});
      tab.location.href = "http://localhost/other";
      await tab.done;
      expect(tab.location.reload).not.toHaveBeenCalled();
    });
  });

  describe("with Web Locks", () => {
    it("reloads once the server reloads", async () => {
      const tab = await runRecoveryScript({}, { browser: createBrowser() });
      await vi.waitFor(() => expect(tab.waits()).toHaveLength(1));
      tab.answer({ status: 204 });
      await vi.waitFor(() => expect(tab.waits()).toHaveLength(2));
      tab.answer({ status: 200, body: { id: "a", v: 2 } });
      await tab.done;
      expect(tab.location.reload).toHaveBeenCalledOnce();
      // No new wait once it reloads
      expect(tab.urls()).toEqual([checkURL, waitURL(1), waitURL(1)]);
    });

    it("waits for a lazily reloaded server to render the page again", async () => {
      const tab = await runRecoveryScript(
        { page: [500, 500, 500, 200] },
        { browser: createBrowser(), poll: true }
      );
      await vi.waitFor(() => expect(tab.waits()).toHaveLength(1));
      tab.answer({ status: 200, body: { id: "a", v: 2 } });
      await vi.waitFor(() => expect(tab.pageLoads()).toBe(3));
      expect(tab.waits().at(-1)).toBe(waitURL(2));
      expect(tab.location.reload).not.toHaveBeenCalled();

      tab.answer({ status: 200, body: { id: "a", v: 3 } });
      await tab.done;
      expect(tab.location.reload).toHaveBeenCalledOnce();
      expect(tab.pageLoads()).toBe(4);
    });

    it("checks the page again at once when the server reloads again", async () => {
      vi.useFakeTimers();
      try {
        const tab = await runRecoveryScript(
          { page: [500, 200] },
          { browser: createBrowser(), poll: true, realDelays: true }
        );
        await vi.advanceTimersByTimeAsync(0);
        tab.answer({ status: 200, body: { id: "a", v: 2 } });
        await vi.advanceTimersByTimeAsync(0);
        expect(tab.pageLoads()).toBe(1);
        expect(tab.waits().at(-1)).toBe(waitURL(2));

        // The next check of the first update was due in 250 ms
        tab.answer({ status: 200, body: { id: "a", v: 3 } });
        await vi.advanceTimersByTimeAsync(10);
        expect(tab.pageLoads()).toBe(2);
        expect(tab.location.reload).toHaveBeenCalledOnce();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});

describe("dev error page recovery across tabs", () => {
  it("lets one tab wait and tells the others", async () => {
    const browser = createBrowser();
    const a = await runRecoveryScript({}, { browser });
    const b = await runRecoveryScript({}, { browser });
    await tick();
    expect(a.waits()).toHaveLength(1);
    expect(b.waits()).toHaveLength(0);

    a.answer({ status: 200, body: { id: "a", v: 2 } });
    await Promise.all([a.done, b.done]);
    expect(a.location.reload).toHaveBeenCalledOnce();
    expect(b.location.reload).toHaveBeenCalledOnce();
  });

  it("hands the wait over to a tab that is still broken", async () => {
    const browser = createBrowser();
    const a = await runRecoveryScript({ page: [200] }, { browser, poll: true });
    const b = await runRecoveryScript({}, { browser, poll: true });
    await tick();
    a.answer({ status: 200, body: { id: "a", v: 2 } });
    await vi.waitFor(() => expect(b.waits()).toEqual([waitURL(2)]));
    await vi.waitFor(() => expect(b.pageLoads()).toBe(3));
    expect(a.location.reload).toHaveBeenCalledOnce();
    expect(b.location.reload).not.toHaveBeenCalled();
  });

  it("catches a reload told before the page listened", async () => {
    const browser = createBrowser();
    const a = await runRecoveryScript({}, { browser });
    await tick();
    const b = await runRecoveryScript(
      { route: [{ status: 200, body: { id: "a", v: 2 } }] },
      { browser }
    );
    await vi.waitFor(() => expect(b.location.reload).toHaveBeenCalledOnce());
    expect(b.waits()).toHaveLength(0);
    // The waiting tab is behind too
    await vi.waitFor(() => expect(a.location.reload).toHaveBeenCalledOnce());
    await a.done;
  });

  it("waits while hidden", async () => {
    const browser = createBrowser();
    const a = await runRecoveryScript({}, { browser, hidden: true });
    await tick();
    expect(a.waits()).toHaveLength(1);
  });
});

describe("dev reload signal", () => {
  const request = (signal: DevReloadSignal, query: string, abort?: AbortSignal) => {
    const event = {
      url: new URL(`http://localhost/_nitro/dev/reload?${query}`),
      req: { signal: abort },
      res: { headers: new Headers() },
    } as unknown as H3Event;
    return signal.handle(event);
  };

  it("answers at once for another instance or generation", async () => {
    const signal = new DevReloadSignal();
    signal.bump();
    expect(await request(signal, "id=other&v=1")).toEqual({ id: signal.id, v: 1 });
    expect(await request(signal, `id=${signal.id}&v=0`)).toEqual({ id: signal.id, v: 1 });
    expect(await request(signal, `id=${signal.id}`)).toEqual({ id: signal.id, v: 1 });
  });

  it("answers once the server reloads", async () => {
    const signal = new DevReloadSignal();
    const res = request(signal, `id=${signal.id}&v=0`);
    let settled = false;
    res.then(() => (settled = true));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(settled).toBe(false);
    signal.bump();
    expect(await res).toEqual({ id: signal.id, v: 1 });
  });

  it("answers 204 after the timeout", async () => {
    vi.useFakeTimers();
    try {
      const signal = new DevReloadSignal();
      const res = request(signal, `id=${signal.id}&v=0`);
      await vi.advanceTimersByTimeAsync(25_000);
      expect(((await res) as Response).status).toBe(204);
    } finally {
      vi.useRealTimers();
    }
  });

  it("releases waiting requests on abort and close", async () => {
    const signal = new DevReloadSignal();
    const controller = new AbortController();
    const aborted = request(signal, `id=${signal.id}&v=0`, controller.signal);
    controller.abort();
    expect(((await aborted) as Response).status).toBe(204);

    const pending = request(signal, `id=${signal.id}&v=0`);
    signal.close();
    expect(((await pending) as Response).status).toBe(503);
    expect(((await request(signal, "id=other&v=0")) as Response).status).toBe(503);
  });
});
