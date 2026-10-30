import { describe, expect, it, vi } from "vitest";
import {
  devErrorRecoveryScript,
  isRecoverableDevErrorPage,
  withDevErrorRecovery,
} from "../../src/build/vite/_dev-error-page.ts";

const htmlError = (contentType = "text/html; charset=utf-8") =>
  new Response("<p>error</p>", { status: 500, headers: { "content-type": contentType } });

// Runs the injected module with `createHotContext`, `fetch` and `location` stubbed.
function runRecoveryScript(statuses: number[]) {
  const listeners: Record<string, () => unknown> = {};
  const hot = { on: (event: string, cb: () => unknown) => (listeners[event] = cb) };
  const fetch = vi.fn(async () => new Response(null, { status: statuses.shift() ?? 500 }));
  const location = { href: "http://localhost/page", reload: vi.fn() };
  const source = devErrorRecoveryScript("/@vite/client")
    .replace(/^<script type="module">/, "")
    .replace(/<\/script>$/, "")
    .replace(/^import .*$/m, "");
  new Function("createHotContext", "fetch", "location", source)(() => hot, fetch, location);
  return { listeners, fetch, location };
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
    expect(rest).toContain(`import { createHotContext } from "/base/@vite/client"`);
  });

  it("reloads once the page renders again", async () => {
    const { listeners, fetch, location } = runRecoveryScript([500, 200]);
    expect(listeners["vite:beforeUpdate"]()).toBeUndefined();
    await vi.waitFor(() => expect(location.reload).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("runs one recovery loop at a time", async () => {
    const { listeners, fetch, location } = runRecoveryScript([500, 200]);
    listeners["nitro:server-update"]();
    listeners["vite:beforeUpdate"]();
    await vi.waitFor(() => expect(location.reload).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
