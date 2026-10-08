import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { deploy } from "../../src/deploy.ts";
import { getBuildInfo } from "../../src/build/info.ts";

const execSyncMock = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ execSync: execSyncMock }));

let rootDir: string;
let outputDir: string;

function mockNitro(commands: Record<string, unknown> = {}) {
  return {
    options: {
      preset: "test-preset",
      rootDir,
      output: { dir: outputDir },
      commands,
    },
  } as any;
}

beforeAll(async () => {
  rootDir = await mkdtemp(join(tmpdir(), "nitro-deploy-"));
  outputDir = join(rootDir, "dist", "server-output");
  await mkdir(outputDir, { recursive: true });
  await writeFile(
    join(outputDir, "nitro.json"),
    JSON.stringify({ preset: "test-preset", commands: { deploy: "echo deploy" } })
  );
});

afterAll(async () => {
  await rm(rootDir, { recursive: true, force: true });
});

beforeEach(() => {
  execSyncMock.mockReset();
});

describe("deploy", () => {
  it("runs the deploy command relative to rootDir", async () => {
    await deploy(mockNitro({ deploy: "npx tool deploy ./ --config ./tool.json" }), {
      args: ["--extra", "flag"],
    });
    expect(execSyncMock).toHaveBeenCalledWith(
      "npx tool deploy dist/server-output/ --config dist/server-output/tool.json --extra flag",
      { stdio: "inherit", cwd: rootDir }
    );
  });

  it("rewrites a leading ./ path", async () => {
    await deploy(mockNitro({ deploy: "./deploy.sh --out ./" }));
    expect(execSyncMock).toHaveBeenCalledWith(
      "dist/server-output/deploy.sh --out dist/server-output/",
      { stdio: "inherit", cwd: rootDir }
    );
  });

  it("calls a function deploy command", async () => {
    const fn = vi.fn();
    const nitro = mockNitro({ deploy: fn });
    await deploy(nitro, { args: ["--flag"] });
    expect(fn).toHaveBeenCalledWith(nitro, { args: ["--flag"] });
    expect(execSyncMock).not.toHaveBeenCalled();
  });

  it("throws when the preset has no deploy command", async () => {
    await expect(deploy(mockNitro())).rejects.toThrow(
      "The `test-preset` preset does not have a default deploy command."
    );
  });

  it("throws when there is no build output", async () => {
    const nitro = mockNitro({ deploy: "echo deploy" });
    nitro.options.output.dir = join(rootDir, "missing");
    await expect(deploy(nitro)).rejects.toThrow("Make sure to build first");
    expect(execSyncMock).not.toHaveBeenCalled();
  });
});

describe("getBuildInfo", () => {
  it("reads build info from an explicit outputDir", async () => {
    const res = await getBuildInfo({ outputDir });
    expect(res.outputDir).toBe(outputDir);
    expect(res.buildInfo?.commands?.deploy).toBe("echo deploy");
  });

  it("resolves a relative outputDir against rootDir", async () => {
    const res = await getBuildInfo({ rootDir, outputDir: "dist/server-output" });
    expect(res.outputDir).toBe(outputDir);
    expect(res.buildInfo?.preset).toBe("test-preset");
  });

  it("falls back to .output under rootDir", async () => {
    const res = await getBuildInfo(rootDir);
    expect(res.outputDir).toBeUndefined();
  });
});
