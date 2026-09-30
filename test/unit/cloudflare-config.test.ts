import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createNitro } from "nitropack/core";
import { join, resolve } from "pathe";
import { describe, expect, it, vi } from "vitest";

describe("Cloudflare asset configuration diagnostics", () => {
  it.each([
    {
      title: "routing policy",
      fileAssets: { html_handling: "drop-trailing-slash" as const },
      contextAssets: {},
      warns: false,
    },
    {
      title: "matching generated values",
      fileAssets: { binding: "ASSETS", directory: "../public" },
      contextAssets: {},
      warns: false,
    },
    {
      title: "matching directory with Windows separators",
      fileAssets: { directory: "..\\public" },
      contextAssets: {},
      warns: false,
    },
    {
      title: "conflicting file binding with context routing policy",
      fileAssets: { binding: "CUSTOM" },
      contextAssets: { html_handling: "drop-trailing-slash" as const },
      warns: true,
    },
    {
      title: "context binding precedence",
      fileAssets: { binding: "CUSTOM" },
      contextAssets: { binding: "ASSETS" },
      warns: false,
    },
    {
      title: "conflicting context binding",
      fileAssets: {},
      contextAssets: { binding: "CUSTOM" },
      warns: true,
    },
    {
      title: "conflicting asset directory",
      fileAssets: { directory: "../custom" },
      contextAssets: {},
      warns: true,
    },
  ])(
    "reports $title correctly",
    async ({ fileAssets, contextAssets, warns }) => {
      const rootDir = await mkdtemp(
        join(tmpdir(), "nitro-assets-diagnostics-")
      );
      await writeFile(
        join(rootDir, "wrangler.json"),
        JSON.stringify({ name: "test-worker", assets: fileAssets })
      );
      const nitro = await createNitro({
        rootDir,
        preset: "cloudflare-module",
        compatibilityDate: "2026-09-30",
        cloudflare: { deployConfig: true, wrangler: { assets: contextAssets } },
      });
      const warn = vi.spyOn(nitro.logger, "warn");
      try {
        await nitro.hooks.callHook("compiled", nitro);
        const generated = JSON.parse(
          await readFile(
            join(nitro.options.output.serverDir, "wrangler.json"),
            "utf8"
          )
        );
        expect(generated.assets.binding).toBe("ASSETS");
        expect(
          resolve(nitro.options.output.serverDir, generated.assets.directory)
        ).toBe(resolve(nitro.options.output.publicDir));
        expect(
          warn.mock.calls.some(([message]) =>
            String(message).includes("Wrangler config `assets`")
          )
        ).toBe(warns);
        if ("html_handling" in contextAssets || "html_handling" in fileAssets) {
          expect(generated.assets.html_handling).toBe("drop-trailing-slash");
        }
      } finally {
        warn.mockRestore();
        await nitro.close();
        await rm(rootDir, { recursive: true, force: true });
      }
    }
  );
});
