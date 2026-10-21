import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import consola from "consola";
import { join } from "pathe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startPreview } from "../../src/preview.ts";

describe("preview", () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), "nitro-preview-"));
    await writeFile(join(rootDir, "nitro.config.mjs"), "export default {};");
    vi.spyOn(consola, "box").mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(rootDir, { recursive: true, force: true });
  });

  async function writeBuild(date: Date) {
    await mkdir(join(rootDir, ".output"), { recursive: true });
    await writeFile(
      join(rootDir, ".output/nitro.json"),
      JSON.stringify({ date: date.toJSON(), preset: "node-server", versions: { nitro: "3" } })
    );
  }

  it("warns when the config changed after the build", async () => {
    await writeBuild(new Date(Date.now() - 60_000));
    const warn = vi.spyOn(consola, "warn").mockImplementation(() => {});
    const preview = await startPreview({ rootDir });
    await preview.close();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("`nitro.config.mjs` changed after"));
  });

  it("does not warn for a build newer than the config", async () => {
    await writeBuild(new Date(Date.now() + 60_000));
    const warn = vi.spyOn(consola, "warn").mockImplementation(() => {});
    const preview = await startPreview({ rootDir });
    await preview.close();
    expect(warn).not.toHaveBeenCalled();
  });
});
