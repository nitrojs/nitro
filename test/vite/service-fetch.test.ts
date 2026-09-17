import { rm } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { stripVTControlCharacters } from "node:util";
import { toRequest } from "h3";
import { join } from "pathe";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

const { createBuilder, createLogger, createServer } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

// #4606: dev and prod resolve a service entry's `fetch` handler the same way (`default.fetch` wins
// over a named `fetch` export, and a `fetch` helper shared with another chunk is never mistaken for
// the handler), and an entry without a handler is reported at build time and with a clear runtime
// error instead of `mod.fetch is not a function`.
describe("vite: service fetch handler", { sequential: true }, () => {
  const rootDir = fileURLToPath(new URL("./service-fetch-fixture", import.meta.url));
  const originalCwd = process.cwd();
  const originalPreset = process.env.NITRO_PRESET;

  const missingHandler = (name: string, entry: string) =>
    `Service "${name}" (${entry}) does not export a \`fetch\` handler (expected \`export default { fetch }\` or \`export function fetch\`).`;

  beforeAll(async () => {
    process.chdir(rootDir);
    process.env.NITRO_PRESET = "standard";
    await rm(join(rootDir, ".output"), { recursive: true, force: true });
  });

  afterAll(() => {
    process.chdir(originalCwd);
    if (originalPreset === undefined) {
      delete process.env.NITRO_PRESET;
    } else {
      process.env.NITRO_PRESET = originalPreset;
    }
  });

  test("dev: prefers `default.fetch` and rejects entries without a handler", async () => {
    const server = await createServer({ root: rootDir, logLevel: "warn" });
    try {
      await server.listen("0" as unknown as number);
      const { port } = server.httpServer!.address() as { port: number };
      const url = (path: string) => `http://localhost:${port}${path}`;

      const res = await fetch(url("/"));
      expect(res.status).toBe(200);
      expect(await res.text()).toBe(`rendered:${url("/")}:function:function`);

      for (const [name, entry] of [
        ["render", "app/entry-render.ts"],
        ["bad", "app/entry-bad.ts"],
      ]) {
        const res = await fetch(url(`/${name}`));
        expect(res.status).toBe(500);
        // The dev error handler keeps the stack (with the message) in the JSON body
        const body = (await res.json()) as { stack: string[] };
        expect(body.stack.join("\n")).toContain(missingHandler(name, join(rootDir, entry)));
      }
    } finally {
      await server.close();
      delete (globalThis as any).__nitro__;
    }
  }, 60_000);

  test("prod: prefers `default.fetch` and reports entries without a handler", async () => {
    const warnings: string[] = [];
    const logger = createLogger("warn", { allowClearScreen: false });
    const warn = logger.warn;
    logger.warn = (msg, opts) => {
      warnings.push(stripVTControlCharacters(msg));
      warn(msg, opts);
    };
    const builder = await createBuilder({ root: rootDir, customLogger: logger });
    await builder.buildApp();

    // Only the entry exporting neither `default` nor `fetch` is visible at build time
    expect(warnings.filter((w) => w.includes("exports neither"))).toEqual([
      expect.stringContaining(
        'Service "bad" entry (app/entry-bad.ts) exports neither `default` nor `fetch` (got: buildId, renderPage).'
      ),
    ]);

    delete (globalThis as any).__nitro__;
    const { default: entry } = await import(
      pathToFileURL(join(rootDir, ".output/server/index.mjs")).href
    );
    const serverFetch = (path: string) => entry.fetch(toRequest(path)) as Promise<Response>;

    const res = await serverFetch("/");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("rendered:http://localhost/:function:function");

    for (const [name, entry] of [
      ["render", "app/entry-render.ts"],
      ["bad", "app/entry-bad.ts"],
    ]) {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const res = await serverFetch(`/${name}`);
        expect(res.status).toBe(500);
        expect(errorSpy.mock.calls.flat().map(String).join("\n")).toContain(
          missingHandler(name, entry)
        );
      } finally {
        errorSpy.mockRestore();
      }
    }
  }, 60_000);
});
