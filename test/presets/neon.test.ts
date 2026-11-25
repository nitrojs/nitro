import { readFile } from "node:fs/promises";
import { resolve } from "pathe";
import { describe, expect, it } from "vitest";
import { setupTest, testNitro } from "../tests.ts";

describe("nitro:preset:neon", async () => {
  const ctx = await setupTest("neon");

  testNitro(
    ctx,
    async () => {
      // The root `index.mjs` is what Neon Functions load.
      const entryPath = resolve(ctx.outDir, "index.mjs");
      const fetchHandler = await import(entryPath).then((m) => m.default.fetch);
      return async ({ url, ...init }) => {
        const pending: Promise<unknown>[] = [];
        globalThis.NEON_REQUEST_CONTEXT = { waitUntil: (promise) => pending.push(promise) };
        try {
          return await fetchHandler(new Request(`https://test.com${url}`, init));
        } finally {
          globalThis.NEON_REQUEST_CONTEXT = undefined;
        }
      };
    },
    (_ctx, callHandler) => {
      it("writes the root entry and neon.json", async () => {
        const entry = await readFile(resolve(ctx.outDir, "index.mjs"), "utf8");
        expect(entry).toBe(`export { default } from "./server/index.mjs";\n`);
        const neon = JSON.parse(await readFile(resolve(ctx.outDir, "neon.json"), "utf8"));
        expect(neon).toMatchObject({ triggers: expect.any(Array) });
      });

      it("rejects cron paths without a trigger delivery header", async () => {
        const res = await callHandler({ url: "/_neon/cron/KiAqICogKg", method: "POST" });
        if (ctx.nitro!.options.experimental.tasks) {
          expect(res.status).toBe(401);
        }
      });
    }
  );
});
