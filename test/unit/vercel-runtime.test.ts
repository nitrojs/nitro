import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import type { Nitro } from "nitro/types";
import { isBun } from "std-env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNitro } from "../../src/builder.ts";
import { generateFunctionFiles, resolveVercelRuntime } from "../../src/presets/vercel/utils.ts";

describe("vercel: resolveVercelRuntime", () => {
  let rootDir: string;
  let warn: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    rootDir = await realpath(await mkdtemp(join(tmpdir(), "nitro-vercel-runtime-")));
    warn = vi.fn();
    stubNodeVersion("26.0.0");
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    restoreNodeVersion();
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
    ["26.x", "nodejs26.x"],
    [">=22.0.0", "nodejs26.x"],
    [">=24.20.0 <25", "nodejs24.x"],
    ["^20.19.0 || >=22.12.0", "nodejs26.x"],
  ])(
    "uses the newest supported Node.js version matching engines.node %s",
    async (node, expected) => {
      expect(await resolveRuntime({ engines: { node } })).toBe(expected);
      expect(warn).not.toHaveBeenCalled();
    }
  );

  it.skipIf(isBun).each([
    ["26.0.0", "nodejs26.x"],
    ["24.1.0", "nodejs24.x"],
    ["22.0.0", "nodejs22.x"],
    ["20.0.0", "nodejs22.x"],
    ["23.0.0", "nodejs24.x"],
    ["25.0.0", "nodejs26.x"],
    ["27.0.0", "nodejs26.x"],
    ["30.2.1", "nodejs26.x"],
  ])("uses the runtime for the build Node.js version %s", async (version, expected) => {
    stubNodeVersion(version);
    expect(await resolveRuntime()).toBe(expected);
    expect(warn).not.toHaveBeenCalled();
  });

  it("accepts an explicit nodejs26.x runtime", async () => {
    stubNodeVersion("24.0.0");
    expect(await resolveRuntime({ runtime: "nodejs26.x" })).toBe("nodejs26.x");
  });

  it("does not select versions newer than 26 when building on them", async () => {
    stubNodeVersion("28.0.0");
    expect(await resolveRuntime({ engines: { node: ">=22" } })).toBe("nodejs26.x");
    expect(warn).not.toHaveBeenCalled();
    expect(await resolveRuntime({ engines: { node: "28.x" } })).toBe("nodejs26.x");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("(22, 24, 26)"));
  });

  it("uses engines.node when building with Bun", async () => {
    stubBun();
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
    stubBun();
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
    stubBun();
    expect(await resolveRuntime()).toBe("bun1.x");
  });

  it.each(["20.x", "18.x", ">=28", "lts/*"])(
    "warns and uses the build Node.js version when engines.node %s matches no supported version",
    async (node) => {
      const fallback = await resolveRuntime({ engines: { node } });
      expect(fallback).toMatch(/^nodejs\d+\.x$/);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(node));
      if (!isBun) {
        expect(await resolveRuntime()).toBe(fallback);
      }
      // engines.node still asks for Node.js, so a Bun build does not switch to Bun
      stubBun();
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
    stubBun();
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

const originalNodeVersion = Object.getOwnPropertyDescriptor(process.versions, "node")!;

function stubNodeVersion(version: string) {
  Object.defineProperty(process.versions, "node", { ...originalNodeVersion, value: version });
}

function restoreNodeVersion() {
  Object.defineProperty(process.versions, "node", originalNodeVersion);
}

// `Bun` is a non-configurable global on Bun
function stubBun() {
  if (!isBun) {
    vi.stubGlobal("Bun", {});
  }
}
