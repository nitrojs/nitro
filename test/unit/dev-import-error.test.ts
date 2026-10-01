import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Listener } from "listhen";
import { build, createDevServer, createNitro, prepare } from "nitropack/core";
import { fetch } from "ofetch";
import { joinURL } from "ufo";

// Regression test for the dev server reporting a misleading
// `Cannot access '<x>' before initialization` when one server module throws at
// import (evaluation) time. See nitrojs/nitro#1670, nuxt/nuxt#20576.
//
// The fixture has two routes:
//   - /ok    healthy
//   - /boom  throws `boom_import_time_error` at module top level
//
// Expected dev behaviour:
//   - hitting the unrelated /ok route keeps working (the throwing module is
//     only evaluated when its own route is requested);
//   - hitting /boom fails with the *real* error, not a TDZ error about an
//     unrelated internal symbol.
describe("dev: import-time error in one server module", () => {
  const rootDir = fileURLToPath(
    new URL("../fixtures/dev-import-error", import.meta.url)
  );
  let nitro: Awaited<ReturnType<typeof createNitro>>;
  let server: Listener;

  beforeAll(async () => {
    nitro = await createNitro(
      { dev: true, preset: "nitro-dev", rootDir },
      { compatibilityDate: "latest" }
    );
    const devServer = createDevServer(nitro);
    server = await devServer.listen({});
    await prepare(nitro);
    const ready = new Promise<void>((resolve) => {
      nitro.hooks.hook("dev:reload", () => resolve());
    });
    await build(nitro);
    await ready;
  }, 120_000);

  afterAll(async () => {
    await server?.close();
    await nitro?.close();
  });

  const call = (path: string) =>
    fetch(joinURL(server.url, path.slice(1)), {
      redirect: "manual",
    }).then(async (res) => ({ status: res.status, body: await res.text() }));

  it("keeps unrelated routes working", async () => {
    const res = await call("/ok");
    expect(res.body).not.toContain("before initialization");
    expect(res.status).toBe(200);
    expect(res.body).toContain("ok");
  });

  it("surfaces the real error for the throwing route", async () => {
    const res = await call("/boom");
    expect(res.status).toBeGreaterThanOrEqual(500);
    // The real cause must be reported, not an unrelated TDZ symbol.
    expect(res.body).not.toContain("before initialization");
    expect(res.body).toContain("boom_import_time_error");
  });
});
