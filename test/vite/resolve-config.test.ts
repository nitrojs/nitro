import { fileURLToPath } from "node:url";
import { execa } from "execa";
import { describe, expect, test } from "vitest";

// Resolving the Vite config (without creating a dev server) must not start the dev worker,
// otherwise the process is kept alive after the tool is done.
describe("vite: resolve config", () => {
  test("does not keep the process alive", async () => {
    const result = await execa(
      "node",
      [fileURLToPath(new URL("./resolve-config-fixture/resolve.mjs", import.meta.url))],
      { timeout: 20_000, reject: false, env: { NITRO_VITE_PKG: process.env.NITRO_VITE_PKG } }
    );
    expect(result.timedOut).toBe(false);
    expect(result.exitCode).toBe(0);
  }, 30_000);
});
