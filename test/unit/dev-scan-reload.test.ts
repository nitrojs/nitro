import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { isDeepStrictEqual } from "node:util";
import { join } from "pathe";
import { isWindows } from "std-env";
import { afterAll, describe, expect, it } from "vitest";
import { build, createDevServer, createNitro, prepare } from "../../src/builder.ts";
import { scanDirCases, writeFiles } from "./_scan-dirs.ts";
import type { Fetch, ScanDirCase } from "./_scan-dirs.ts";

const tmpDirs: string[] = [];
afterAll(() => {
  for (const dir of tmpDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const builder = (process.env.NITRO_BUILDER as "rollup" | "rolldown" | "rspack") || "rolldown";

describe(`dev scan reload (${builder})`, () => {
  // TODO: rspack dev on Windows (https://github.com/nitrojs/nitro/issues/4948)
  const skip = builder === "rspack" && isWindows;

  it.skipIf(skip).each(scanDirCases)(
    "picks up added, removed and re-added files in `$dir/`",
    (c) => runCase(c),
    60_000
  );

  // Chokidar emits paths relative to `watchOptions.cwd` when it is set
  it.skipIf(skip).each(scanDirCases.filter((c) => c.remove))(
    "picks up a removed `$dir/` with `watchOptions.cwd`",
    (c) => runCase(c, { watchCwd: true }),
    60_000
  );
});

async function runCase(c: ScanDirCase, opts: { watchCwd?: boolean } = {}) {
  const rootDir = mkdtempSync(join(tmpdir(), "nitro-dev-scan-reload-"));
  tmpDirs.push(rootDir);
  writeFiles(rootDir, {
    "package.json": JSON.stringify({ type: "module" }),
    ...c.files,
    ...(c.existing && { [c.file]: c.contents }),
  });

  const nitro = await createNitro({
    rootDir,
    serverDir: ".",
    scanDirs: ["layer"],
    builder,
    dev: true,
    compatibilityDate: "latest",
    logLevel: 0,
    experimental: { tasks: true },
    watchOptions: opts.watchCwd ? { cwd: rootDir } : undefined,
  });
  const server = await createDevServer(nitro).listen({ port: 0 });
  const fetchPath: Fetch = (path) => fetch(new URL(path, server.url));

  let errors: unknown[] = [];
  let lingeringErrors: unknown[] = [];
  let reloads = 0;
  let onReload: (() => void) | undefined;
  nitro.hooks.hook("dev:error", (error) => {
    errors.push(error);
    lingeringErrors.push(error);
  });
  nitro.hooks.hook("dev:reload", () => {
    reloads++;
    lingeringErrors = [];
    onReload?.();
  });
  const nextReload = (timeout: number) =>
    new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timed out")), timeout);
      onReload = () => {
        clearTimeout(timer);
        resolve();
      };
    });
  const expectState = async (expected: unknown) => {
    const deadline = Date.now() + 15_000;
    let state: unknown;
    while (true) {
      const seen = reloads;
      state = await c.observe(fetchPath);
      if (isDeepStrictEqual(state, expected)) {
        break;
      }
      if (reloads === seen) {
        await nextReload(deadline - Date.now()).catch(() => {
          throw new Error(`No reload to the expected state, last: ${JSON.stringify(state)}`);
        });
      }
    }
    expect(state).toEqual(expected);
    expect(lingeringErrors).toEqual([]);
    // TODO: the rolldown and rollup watchers build stale virtual modules before the scan dirs
    // watcher reloads, and so does rspack for removed plugins and tasks
    if (builder === "rspack" && !["plugins", "tasks"].includes(c.dir)) {
      expect(errors).toEqual([]);
    }
    errors = [];
  };

  try {
    await prepare(nitro);
    await build(nitro);
    if (c.existing) {
      await expectState(c.added);
      rmSync(join(rootDir, c.remove ?? c.file), { recursive: true });
    }
    await expectState(c.removed);

    writeFiles(rootDir, { [c.file]: c.contents });
    await expectState(c.added);

    rmSync(join(rootDir, c.remove ?? c.file), { recursive: true });
    await expectState(c.removed);

    writeFiles(rootDir, { [c.file]: c.contents });
    await expectState(c.added);
  } finally {
    await server.close();
    await nitro.close();
  }
}
