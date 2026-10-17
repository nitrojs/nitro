import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import type { Nitro } from "nitro/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNitro } from "../../src/builder.ts";
import { generateFunctionFiles, resolveVercelRuntime } from "../../src/presets/vercel/utils.ts";

describe("vercel: resolveVercelRuntime", () => {
  let rootDir: string;
  let warn: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    rootDir = await realpath(await mkdtemp(join(tmpdir(), "nitro-vercel-runtime-")));
    warn = vi.fn();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await rm(rootDir, { recursive: true, force: true });
  });

  async function resolveRuntime(
    opts: { engines?: Record<string, string>; bunVersion?: string; runtime?: string } = {}
  ) {
    // Always write a package.json so the lookup never leaves the sandbox
    await writeFile(join(rootDir, "package.json"), JSON.stringify({ engines: opts.engines }));
    if (opts.bunVersion) {
      await writeFile(
        join(rootDir, "vercel.json"),
        JSON.stringify({ bunVersion: opts.bunVersion })
      );
    }
    const nitro = {
      logger: { warn },
      options: { rootDir, vercel: { functions: { runtime: opts.runtime } } },
    } as unknown as Nitro;
    const runtime = await resolveVercelRuntime(nitro);
    expect(nitro.options.vercel!.functions!.runtime).toBe(runtime);
    return runtime;
  }

  it("prefers the explicit runtime", async () => {
    expect(
      await resolveRuntime({ runtime: "nodejs22.x", engines: { node: "24.x", bun: "1.x" } })
    ).toBe("nodejs22.x");
  });

  it.each([
    ["22.x", "nodejs22.x"],
    ["^22", "nodejs22.x"],
    [">=20 <24", "nodejs22.x"],
    [">=22.0.0", "nodejs24.x"],
    [">=24.20.0 <25", "nodejs24.x"],
    ["^20.19.0 || >=22.12.0", "nodejs24.x"],
  ])(
    "uses the newest supported Node.js version matching engines.node %s",
    async (node, expected) => {
      expect(await resolveRuntime({ engines: { node } })).toBe(expected);
      expect(warn).not.toHaveBeenCalled();
    }
  );

  it("uses engines.node when building with Bun", async () => {
    vi.stubGlobal("Bun", {});
    expect(await resolveRuntime({ engines: { node: ">=24.20.0 <25" } })).toBe("nodejs24.x");
    expect(await resolveRuntime({ engines: { node: "^22" } })).toBe("nodejs22.x");
  });

  it("uses bun with engines.bun", async () => {
    expect(await resolveRuntime({ engines: { bun: "1.x" } })).toBe("bun1.x");
  });

  it.each([
    ["1.4.x", "bun1.4.x"],
    ["^1.4.0", "bun1.4.x"],
    [">=1.4", "bun1.4.x"],
    ["1.x", "bun1.x"],
    [">=1", "bun1.x"],
    ["^1.3.0", "bun1.x"],
  ])("selects the Bun runtime for range %s", async (bun, expected) => {
    expect(await resolveRuntime({ engines: { bun } })).toBe(expected);
    expect(await resolveRuntime({ bunVersion: bun })).toBe(expected);
  });

  it("prefers engines.bun over bunVersion when selecting the Bun version", async () => {
    expect(
      await resolveRuntime({ engines: { node: "22.x", bun: "1.4.x" }, bunVersion: "1.x" })
    ).toBe("bun1.4.x");
    expect(await resolveRuntime({ engines: { bun: "1.x" }, bunVersion: "1.4.x" })).toBe("bun1.x");
  });

  it.each(["2.x", "latest", "not-a-version"])("rejects unsupported Bun range %s", async (bun) => {
    await expect(resolveRuntime({ engines: { bun } })).rejects.toThrow(
      `Invalid Vercel Bun version \`${bun}\` in \`engines.bun\` in \`package.json\``
    );
    await expect(resolveRuntime({ bunVersion: bun })).rejects.toThrow(
      `Invalid Vercel Bun version \`${bun}\` in \`bunVersion\` in \`vercel.json\``
    );
  });

  it("uses engines.node when both engines are set and vercel.json has no bunVersion", async () => {
    vi.stubGlobal("Bun", {});
    expect(await resolveRuntime({ engines: { node: "22.x", bun: "1.x" } })).toBe("nodejs22.x");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("engines.bun"));
  });

  it("uses bun when both engines are set and vercel.json has bunVersion", async () => {
    expect(await resolveRuntime({ engines: { node: "22.x", bun: "1.x" }, bunVersion: "1.x" })).toBe(
      "bun1.x"
    );
  });

  it("prefers engines.node over bunVersion in vercel.json", async () => {
    expect(await resolveRuntime({ engines: { node: "22.x" }, bunVersion: "1.x" })).toBe(
      "nodejs22.x"
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("bunVersion"));
  });

  it("uses bun with bunVersion in vercel.json", async () => {
    expect(await resolveRuntime({ bunVersion: "1.x" })).toBe("bun1.x");
  });

  it("uses bun when building with Bun without engines", async () => {
    vi.stubGlobal("Bun", {});
    expect(await resolveRuntime()).toBe("bun1.x");
  });

  it.each(["20.x", "18.x", ">=26", "lts/*"])(
    "warns and uses the build Node.js version when engines.node %s matches no supported version",
    async (node) => {
      const fallback = await resolveRuntime();
      expect(fallback).toMatch(/^nodejs\d+\.x$/);
      expect(await resolveRuntime({ engines: { node } })).toBe(fallback);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(node));
      // engines.node still asks for Node.js, so a Bun build does not switch to Bun
      vi.stubGlobal("Bun", {});
      expect(await resolveRuntime({ engines: { node } })).toBe(fallback);
    }
  );
});

describe("vercel preset: function runtime from engines", () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await realpath(await mkdtemp(join(tmpdir(), "nitro-vercel-preset-runtime-")));
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await rm(rootDir, { recursive: true, force: true });
  });

  async function generateFunctionConfig(engines: Record<string, string>) {
    await writeFile(join(rootDir, "package.json"), JSON.stringify({ type: "module", engines }));
    const nitro = await createNitro({
      rootDir,
      preset: "vercel",
      compatibilityDate: "2025-01-01",
      logLevel: 0,
    });
    await nitro.hooks.callHook("build:before", nitro);
    await generateFunctionFiles(nitro);
    await nitro.close();
    const config = JSON.parse(
      await readFile(join(nitro.options.output.serverDir, ".vc-config.json"), "utf8")
    );
    return { runtime: config.runtime, exportConditions: nitro.options.exportConditions };
  }

  it("writes a Node.js function without the bun condition for engines.node built with Bun", async () => {
    vi.stubGlobal("Bun", {});
    const { runtime, exportConditions } = await generateFunctionConfig({ node: ">=24.20.0 <25" });
    expect(runtime).toBe("nodejs24.x");
    expect(exportConditions).not.toContain("bun");
  });

  it("writes a Bun function with the bun condition for engines.bun", async () => {
    const { runtime, exportConditions } = await generateFunctionConfig({ bun: "1.x" });
    expect(runtime).toBe("bun1.x");
    expect(exportConditions).toContain("bun");
  });

  it("writes a Bun 1.4 function when engines.bun requires it", async () => {
    const { runtime, exportConditions } = await generateFunctionConfig({ bun: "1.4.x" });
    expect(runtime).toBe("bun1.4.x");
    expect(exportConditions).toContain("bun");
  });
});
