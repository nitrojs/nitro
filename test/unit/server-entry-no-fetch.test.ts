import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { build, createNitro, prepare } from "nitro/builder";

// A server entry can be used for startup logic only, without a `fetch` handler
const entries = {
  "no default export": `globalThis.__serverEntryStarted = "no-default";`,
  "default export without fetch": `globalThis.__serverEntryStarted = "no-fetch";\nexport default { port: 3999 };`,
  "named default export without fetch": `globalThis.__serverEntryStarted = "named";\nconst config = { port: 3999 };\nexport { config as default };`,
};

const builders = ["rollup", "rolldown"] as const;

describe("server entry without fetch", () => {
  for (const [name, code] of Object.entries(entries)) {
    for (const builder of builders) {
      describe(`${name} (${builder})`, () => {
        let rootDir: string;
        let fetch: (req: Request) => Promise<Response>;
        const warnings: string[] = [];

        beforeAll(async () => {
          rootDir = await realpath(await mkdtemp(join(tmpdir(), "nitro-server-entry-")));
          await mkdir(join(rootDir, "routes"));
          await writeFile(join(rootDir, "server.ts"), code);
          await writeFile(join(rootDir, "routes/hello.ts"), `export default () => "hello";`);
          const warn = vi.spyOn(console, "warn").mockImplementation((msg) => {
            warnings.push(String(msg));
          });
          const nitro = await createNitro({
            rootDir,
            serverDir: "./",
            preset: "standard",
            builder,
            logLevel: 0,
          });
          try {
            await prepare(nitro);
            await build(nitro);
          } finally {
            await nitro.close();
            warn.mockRestore();
          }
          delete (globalThis as any).__serverEntryStarted;
          fetch = await import(join(rootDir, ".output/server/index.mjs")).then(
            (m) => m.default.fetch
          );
        }, 60_000);

        afterAll(async () => {
          delete (globalThis as any).__serverEntryStarted;
          await rm(rootDir, { recursive: true, force: true });
        });

        it("builds without warnings about the default export", () => {
          expect(warnings.filter((w) => w.includes("default"))).toEqual([]);
        });

        it("runs the server entry on startup", () => {
          expect((globalThis as any).__serverEntryStarted).toBeDefined();
        });

        it("serves routes", async () => {
          const res = await fetch(new Request("http://localhost/hello"));
          expect(res.status).toBe(200);
          expect(await res.text()).toBe("hello");
        });

        it("responds with 404 for unmatched requests", async () => {
          const res = await fetch(new Request("http://localhost/unknown"));
          expect(res.status).toBe(404);
        });
      });
    }
  }
});
