import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeAmplifyFiles } from "../../src/presets/aws-amplify/utils.ts";

describe("aws-amplify utils", () => {
  let outDir: string;

  beforeEach(async () => {
    outDir = await mkdtemp(join(tmpdir(), "nitro-amplify-"));
    await mkdir(join(outDir, "compute/default"), { recursive: true });
  });

  afterEach(async () => {
    await rm(outDir, { recursive: true, force: true });
  });

  async function getComputeRuntime(awsAmplify?: Record<string, unknown>) {
    const nitro = {
      options: {
        output: { dir: outDir },
        static: false,
        baseURL: "/",
        publicAssets: [],
        framework: {},
        awsAmplify,
      },
    } as any;
    await writeAmplifyFiles(nitro);
    const manifest = JSON.parse(await readFile(join(outDir, "deploy-manifest.json"), "utf8"));
    return manifest.computeResources[0].runtime;
  }

  it("defaults compute runtime to nodejs22.x", async () => {
    expect(await getComputeRuntime()).toBe("nodejs22.x");
  });

  it("respects configured runtime", async () => {
    expect(await getComputeRuntime({ runtime: "nodejs24.x" })).toBe("nodejs24.x");
  });
});
