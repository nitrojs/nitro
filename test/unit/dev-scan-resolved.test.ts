import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterAll, describe, expect, it } from "vitest";
import { build, createDevServer, createNitro, prepare } from "../../src/builder.ts";
import { writeFiles } from "./_scan-dirs.ts";
import { scanResolvedRecorder } from "./_scan-resolved.ts";

const tmpDirs: string[] = [];
afterAll(() => {
  for (const dir of tmpDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const builder = (process.env.NITRO_BUILDER as "rollup" | "rolldown" | "rspack") || "rolldown";

describe(`scan:resolved hook (${builder})`, () => {
  it("is called with the scan of the production build", async () => {
    const rootDir = createRoot();
    const recorder = scanResolvedRecorder();
    const nitro = await createNitro({
      rootDir,
      serverDir: ".",
      builder,
      compatibilityDate: "latest",
      logLevel: 0,
      modules: [recorder.module],
    });
    try {
      expect(recorder.calls).toEqual([recorder.current()]);
      await prepare(nitro);
      await build(nitro);
      expect(recorder.calls.length).toBeGreaterThan(1);
      expect(recorder.calls.at(-1)).toEqual(recorder.current());
      expect(recorder.calls.at(-1)?.scanned).toEqual(["/ *"]);
      expect(recorder.calls.at(-1)?.routed).toEqual(["/ *"]);
    } finally {
      await nitro.close();
    }
  }, 60_000);

  // TODO: build hooks throwing in development (`scan:resolved`, `compiled`, `dev:reload`) are
  // unhandled rejections with the rollup, rolldown, rspack and vite dev watchers
  it.todo("keeps reloading in development when a hook throws", async () => {
    const rootDir = createRoot();
    const recorder = scanResolvedRecorder();
    const failure = new Error("scan:resolved failure");
    let fail = false;
    const nitro = await createNitro({
      rootDir,
      serverDir: ".",
      builder,
      dev: true,
      compatibilityDate: "latest",
      logLevel: 0,
      modules: [
        recorder.module,
        {
          name: "throws-once",
          setup(nitro) {
            nitro.hooks.hook("scan:resolved", () => {
              if (fail) {
                fail = false;
                throw failure;
              }
            });
          },
        },
      ],
    });
    const errors: unknown[] = [];
    nitro.hooks.hook("dev:error", (error) => {
      errors.push(error);
    });
    const server = await createDevServer(nitro).listen({ port: 0 });
    const text = async (path: string) => {
      const res = await fetch(new URL(path, server.url));
      return res.ok ? await res.text() : res.status;
    };
    try {
      await prepare(nitro);
      await build(nitro);
      await expectEventually(() => text("/"), "index");

      fail = true;
      writeFiles(rootDir, { "routes/added.ts": `export default () => "added";` });
      await expectEventually(() => errors.includes(failure), true);
      // The scan is applied before the hook is called
      await expectEventually(() => text("/added"), "added");

      rmSync(join(rootDir, "routes/added.ts"));
      await expectEventually(() => text("/added"), 404);
      expect(recorder.calls.at(-1)).toEqual(recorder.current());
      expect(recorder.calls.at(-1)?.scanned).toEqual(["/ *"]);
    } finally {
      await server.close();
      await nitro.close();
    }
  }, 60_000);
});

function createRoot() {
  const rootDir = mkdtempSync(join(tmpdir(), "nitro-scan-resolved-"));
  tmpDirs.push(rootDir);
  writeFiles(rootDir, {
    "package.json": JSON.stringify({ type: "module" }),
    "routes/index.ts": `export default () => "index";`,
  });
  return rootDir;
}

async function expectEventually(fn: () => unknown, expected: unknown, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  let value = await fn();
  while (value !== expected && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    value = await fn();
  }
  expect(value).toEqual(expected);
}
