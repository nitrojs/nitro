import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "pathe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeWranglerConfig } from "../../src/presets/cloudflare/utils.ts";

function createNitroStub(
  overrides: { static?: boolean; compatibilityDate?: string; wrangler?: Record<string, any> } = {}
) {
  const root = mkdtempSync(join(tmpdir(), "nitro-cf-wrangler-"));
  return {
    root,
    nitro: {
      options: {
        static: overrides.static ?? false,
        baseURL: "/",
        rootDir: root,
        workspaceDir: root,
        output: {
          dir: join(root, ".output"),
          serverDir: join(root, ".output/server"),
          publicDir: join(root, ".output/public"),
        },
        compatibilityDate: {
          cloudflare: overrides.compatibilityDate ?? "2025-10-24",
          default: overrides.compatibilityDate ?? "2025-10-24",
        },
        cloudflare: { deployConfig: true, nodeCompat: true, wrangler: overrides.wrangler },
        experimental: {},
        scheduledTasks: {},
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        success: vi.fn(),
      },
    } as any,
  };
}

describe("writeWranglerConfig (cloudflare-module)", () => {
  let cleanup: string[] = [];
  beforeEach(() => {
    cleanup = [];
  });
  afterEach(() => {
    for (const dir of cleanup) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("emits main and ASSETS binding for a normal (non-static) build", async () => {
    const { root, nitro } = createNitroStub({ static: false });
    cleanup.push(root);
    await writeWranglerConfig(nitro, "module");
    const config = JSON.parse(readFileSync(join(root, ".output/server/wrangler.json"), "utf8"));
    expect(config.main).toBe("index.mjs");
    expect(config.assets).toEqual({ binding: "ASSETS", directory: "../public" });
    expect(config.no_bundle).toBe(true);
    expect(config.rules).toEqual([{ type: "ESModule", globs: ["**/*.mjs", "**/*.js"] }]);
  });

  it("omits main, ASSETS binding and module bundling rules for a static build", async () => {
    // Regression test for nuxt/nuxt#34186 — `nuxt generate` (which sets
    // `nitro.options.static = true`) targeting cloudflare_module previously
    // wrote a wrangler.json pointing at a non-existent index.mjs.
    const { root, nitro } = createNitroStub({ static: true });
    cleanup.push(root);
    await writeWranglerConfig(nitro, "module");
    const config = JSON.parse(readFileSync(join(root, ".output/server/wrangler.json"), "utf8"));
    expect(config.main).toBeUndefined();
    expect(config.assets).toEqual({ directory: "../public" });
    expect(config.no_bundle).toBeUndefined();
    expect(config.rules).toBeUndefined();
  });

  it.each([
    ["2024-09-22", []],
    ["2024-09-23", ["nodejs_compat"]],
    ["2024-09-24", ["nodejs_compat"]],
    ["2026-08-03", ["nodejs_compat"]],
    ["2026-08-04", []],
    ["2026-08-05", []],
  ])(
    "uses the required Node.js compatibility flags for compatibility date %s",
    async (compatibilityDate, expected) => {
      const { root, nitro } = createNitroStub({ compatibilityDate });
      cleanup.push(root);
      await writeWranglerConfig(nitro, "module");
      const config = JSON.parse(readFileSync(join(root, ".output/server/wrangler.json"), "utf8"));
      expect(config.compatibility_flags).toEqual(expected);
    }
  );
});

describe("writeWranglerConfig override warnings", () => {
  let cleanup: string[] = [];
  beforeEach(() => {
    cleanup = [];
  });
  afterEach(() => {
    for (const dir of cleanup) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it.each([
    { title: "routing policy", file: { html_handling: "drop-trailing-slash" }, warns: false },
    {
      title: "matching generated values",
      file: { binding: "ASSETS", directory: "./.output/public" },
      warns: false,
    },
    {
      title: "matching directory with trailing slash",
      file: { directory: ".output/public/" },
      warns: false,
    },
    {
      title: "matching directory with Windows separators",
      file: { directory: ".\\.output\\public" },
      warns: false,
    },
    {
      title: "unset asset fields from JSON",
      file: { directory: null, binding: null },
      warns: false,
    },
    {
      title: "conflicting file binding with context routing policy",
      file: { binding: "CUSTOM" },
      ctx: { html_handling: "drop-trailing-slash" },
      warns: "file",
    },
    {
      title: "context binding precedence",
      file: { binding: "CUSTOM" },
      ctx: { binding: "ASSETS" },
      warns: false,
    },
    { title: "conflicting context binding", ctx: { binding: "CUSTOM" }, warns: "context" },
    { title: "conflicting file directory", file: { directory: "./custom" }, warns: "file" },
    {
      title: "file directory relative to generated config",
      file: { directory: "../public" },
      warns: "file",
    },
    { title: "matching context directory", ctx: { directory: "../public" }, warns: false },
    {
      title: "conflicting context directory",
      ctx: { directory: "./.output/public" },
      warns: "context",
    },
    {
      title: "binding for a static build",
      static: true,
      file: { binding: "CUSTOM" },
      warns: false,
    },
    {
      title: "conflicting directory for a static build",
      static: true,
      file: { directory: "./custom" },
      warns: "file",
    },
  ] as {
    title: string;
    static?: boolean;
    file?: Record<string, any>;
    ctx?: Record<string, any>;
    warns: false | "file" | "context";
  }[])("reports assets $title correctly", async (input) => {
    const { root, nitro } = createNitroStub({
      static: input.static,
      wrangler: input.ctx && { assets: input.ctx },
    });
    cleanup.push(root);
    if (input.file) {
      writeFileSync(join(root, "wrangler.json"), JSON.stringify({ assets: input.file }));
    }
    await writeWranglerConfig(nitro, "module");
    const config = JSON.parse(readFileSync(join(root, ".output/server/wrangler.json"), "utf8"));
    expect(resolve(root, ".output/server", config.assets.directory)).toBe(
      resolve(root, ".output/public")
    );
    const message = nitro.logger.warn.mock.calls
      .map(([message]: [string]) => message)
      .find((message: string) => message.includes("Wrangler config `assets`"));
    expect(Boolean(message)).toBe(Boolean(input.warns));
    if (message) {
      expect(message.includes(" set by config or modules")).toBe(input.warns === "context");
    }
    if (input.file?.html_handling || input.ctx?.html_handling) {
      expect(config.assets.html_handling).toBe("drop-trailing-slash");
    }
  });

  it("separates the context source from the key in other override warnings", async () => {
    const { root, nitro } = createNitroStub({ wrangler: { main: "./custom.mjs" } });
    cleanup.push(root);
    await writeWranglerConfig(nitro, "module");
    expect(nitro.logger.warn).toHaveBeenCalledWith(
      "[cloudflare] Wrangler config `main` set by config or modules is overridden and will be ignored."
    );
  });
});
