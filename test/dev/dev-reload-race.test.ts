import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { promises as fsp } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { isWindows } from "std-env";
import { describe, expect, it } from "vitest";
import { type Context, describeIf, setupTest } from "../tests";

const HANG_TIMEOUT_MS = 10_000;
const REQUEST_ASSIGN_DELAY_MS = 100;

async function waitForDevWorker(
  context: Context,
  timeoutMilliseconds = 30_000
) {
  const start = Date.now();
  while (Date.now() - start < timeoutMilliseconds) {
    try {
      await context.fetch("/api/hello");
      return;
    } catch {
      // Retry until the dev worker is ready.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 200));
  }
  throw new Error("Dev worker not ready");
}

async function parseFetchBody<T>(response: T): Promise<unknown> {
  if (response instanceof Response) {
    return response.json();
  }
  return response;
}

async function assertRequestCompletes<T>(
  requestPromise: Promise<T>,
  timeoutMilliseconds = HANG_TIMEOUT_MS
) {
  return Promise.race([
    requestPromise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Request hung during dev reload")),
        timeoutMilliseconds
      )
    ),
  ]);
}

async function waitForDevStart(context: Context) {
  await new Promise<void>((resolvePromise) => {
    context.nitro!.hooks.hookOnce("dev:start", () => resolvePromise());
  });
}

async function waitForDevReload(context: Context) {
  await new Promise<void>((resolvePromise) => {
    context.nitro!.hooks.hookOnce("dev:reload", () => resolvePromise());
  });
}

function createTempFixtureRoot() {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "nitro-dev-reload-race-"));
  mkdirSync(join(fixtureRoot, "api"), { recursive: true });

  writeFileSync(
    join(fixtureRoot, "api", "hello.ts"),
    `export default eventHandler(() => ({ message: "initial" }));\n`
  );
  writeFileSync(
    join(fixtureRoot, "api", "dev-reload-slow.ts"),
    `export default eventHandler(async () => {
  await new Promise((resolve) => setTimeout(resolve, 3_000));
  return { ok: true };
});\n`
  );

  return fixtureRoot;
}

describe("dev server reload race", { timeout: 60_000, hookTimeout: 60_000 }, () => {
  describe("hook-based", async () => {
    const context = await setupTest("nitro-dev");

    it("does not hang in-flight requests during rebuild", async () => {
      await context.nitro!.hooks.callHook("dev:start");
      await context.nitro!.hooks.callHook("dev:reload");
      await waitForDevWorker(context);

      await context.nitro!.hooks.callHook("dev:start");

      const requestPromise = context.fetch("/api/dev-reload-slow");

      await new Promise((resolvePromise) =>
        setTimeout(resolvePromise, REQUEST_ASSIGN_DELAY_MS)
      );

      await context.nitro!.hooks.callHook("dev:reload");

      const result = await parseFetchBody(
        await assertRequestCompletes(requestPromise)
      );
      expect(result).toEqual({ ok: true });

      await waitForDevWorker(context);
    });
  });

  describeIf(!isWindows, "file edit", async () => {
    const fixtureRoot = createTempFixtureRoot();
    const helloPath = join(fixtureRoot, "api", "hello.ts");
    const context = await setupTest("nitro-dev", {
      config: {
        rootDir: fixtureRoot,
        srcDir: fixtureRoot,
      },
    });

    it("does not hang in-flight requests on the second API edit", async () => {
      const firstReloadPromise = waitForDevReload(context);
      await fsp.writeFile(
        helloPath,
        `export default eventHandler(() => ({ message: "v1" }));\n`
      );
      await firstReloadPromise;
      await waitForDevWorker(context);

      const devStartPromise = waitForDevStart(context);
      await fsp.writeFile(
        helloPath,
        `export default eventHandler(() => ({ message: "v2" }));\n`
      );
      await devStartPromise;

      const requestPromise = context.fetch("/api/dev-reload-slow");

      const devReloadPromise = waitForDevReload(context);

      await new Promise((resolvePromise) =>
        setTimeout(resolvePromise, REQUEST_ASSIGN_DELAY_MS)
      );

      await devReloadPromise;

      const result = await parseFetchBody(
        await assertRequestCompletes(requestPromise)
      );
      expect(result).toEqual({ ok: true });

      await waitForDevWorker(context);
    });
  });
});
