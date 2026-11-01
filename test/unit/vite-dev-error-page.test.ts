import { describe, expect, it, vi } from "vitest";
import {
  devErrorRecoveryScript,
  isDocumentRequest,
  isRecoverableDevErrorPage,
  withDevErrorRecovery,
} from "../../src/build/vite/_dev-error-page.ts";

const htmlError = (contentType = "text/html; charset=utf-8") =>
  new Response("<p>error</p>", { status: 500, headers: { "content-type": contentType } });

// Runs the injected module with `document`, the Vite client, `fetch` and `location` stubbed.
async function runRecoveryScript(statuses: number[], opts: { clientModules?: boolean } = {}) {
  const listeners: Record<string, (payload?: unknown) => unknown> = {};
  const hot = {
    on: (event: string, cb: (payload?: unknown) => unknown) => (listeners[event] = cb),
  };
  const importClient = vi.fn(async () => ({ createHotContext: () => hot }));
  const document = { querySelector: () => (opts.clientModules ? {} : null) };
  const fetch = vi.fn(async () => new Response(null, { status: statuses.shift() ?? 500 }));
  const location = { href: "http://localhost/page", reload: vi.fn() };
  const source = devErrorRecoveryScript("/@vite/client")
    .replace(/^<script type="module">/, "")
    .replace(/<\/script>$/, "")
    .replace("await import(", "await importClient(");
  const AsyncFunction = (async () => {}).constructor as FunctionConstructor;
  await new AsyncFunction("document", "importClient", "fetch", "location", source)(
    document,
    importClient,
    fetch,
    location
  );
  return { listeners, importClient, fetch, location };
}

describe("vite dev error page recovery", () => {
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

  it("only injects into page loads", () => {
    expect(isDocumentRequest({ "sec-fetch-dest": "document" })).toBe(true);
    expect(isDocumentRequest({ "sec-fetch-dest": "iframe" })).toBe(true);
    expect(isDocumentRequest({ "sec-fetch-dest": "frame" })).toBe(true);
    expect(isDocumentRequest({ "sec-fetch-dest": "empty", accept: "text/html" })).toBe(false);
    expect(isDocumentRequest({ accept: "text/html,application/xhtml+xml" })).toBe(true);
    expect(isDocumentRequest({ accept: "*/*" })).toBe(false);
    expect(isDocumentRequest({})).toBe(false);
  });

  it("forwards a streamed page before it ends and appends the script", async () => {
    let source!: ReadableStreamDefaultController<Uint8Array>;
    const res = new Response(new ReadableStream({ start: (c) => void (source = c) }), {
      status: 500,
      headers: { "content-type": "text/html", "content-length": "11" },
    });
    const recovered = withDevErrorRecovery(res, "/base/");
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
    expect(rest).toContain(`await import("/base/@vite/client")`);
  });

  it("reloads once the page renders again", async () => {
    const { listeners, fetch, location } = await runRecoveryScript([500, 200]);
    expect(listeners["nitro:server-update"]()).toBeUndefined();
    await vi.waitFor(() => expect(location.reload).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("runs one recovery loop at a time", async () => {
    const { listeners, fetch, location } = await runRecoveryScript([500, 200]);
    listeners["nitro:server-update"]();
    listeners["nitro:server-update"]();
    await vi.waitFor(() => expect(location.reload).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not poll on client-only HMR updates", async () => {
    const { listeners } = await runRecoveryScript([200]);
    expect(listeners["vite:beforeUpdate"]).toBeUndefined();
  });

  it("leaves pages that load their own client modules to them", async () => {
    const { listeners, importClient } = await runRecoveryScript([200], { clientModules: true });
    expect(importClient).not.toHaveBeenCalled();
    expect(listeners).toEqual({});
  });

  it("stops after a client-side navigation", async () => {
    const { listeners, fetch, location } = await runRecoveryScript([200]);
    location.href = "http://localhost/other";
    listeners["nitro:server-update"]();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fetch).not.toHaveBeenCalled();
    expect(location.reload).not.toHaveBeenCalled();
  });

  it("leaves the reload to Vite when it reloads the page itself", async () => {
    const { listeners, fetch, location } = await runRecoveryScript([200]);
    listeners["vite:beforeFullReload"]({ type: "full-reload" });
    listeners["nitro:server-update"]();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fetch).not.toHaveBeenCalled();
    expect(location.reload).not.toHaveBeenCalled();
  });

  it("reads response headers only for GET 5xx responses", () => {
    const get = vi.fn(() => "text/html");
    const res = { status: 200, headers: { get, has: get } } as unknown as Response;
    expect(isRecoverableDevErrorPage("GET", res)).toBe(false);
    expect(isRecoverableDevErrorPage("POST", { ...res, status: 500 } as Response)).toBe(false);
    expect(get).not.toHaveBeenCalled();
  });
});
