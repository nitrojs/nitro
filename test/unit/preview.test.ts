import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { parseArgs } from "citty";
import consola from "consola";
import { join } from "pathe";
import * as srvx from "srvx";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import previewCommand from "../../src/cli/commands/preview.ts";
import * as previewModule from "../../src/preview.ts";
import { loadPreviewDotEnv, startPreview } from "../../src/preview.ts";

vi.mock("srvx", () => ({ serve: vi.fn() }));

describe("preview", () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), "nitro-preview-"));
    await writeFile(join(rootDir, "nitro.config.mjs"), "export default {};");
    vi.spyOn(consola, "box").mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
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

  it("loads PORT from .env in the project root", async () => {
    vi.stubEnv("PORT", undefined);
    await writeFile(join(rootDir, ".env"), "PORT=14321\n");
    expect(await loadPreviewDotEnv(rootDir)).toContainEqual(["PORT", "14321"]);
  });

  it.each([undefined, "15432"])(
    "applies dotenv before constructing the CLI server with shell PORT=%s",
    async (port) => {
      vi.stubEnv("PORT", port);
      await writeFile(join(rootDir, ".env"), "PORT=14321\n");
      const serve = vi.mocked(srvx.serve).mockImplementation(() => {
        expect(process.env.PORT).toBe(port || "14321");
        return { serve: vi.fn() } as unknown as ReturnType<typeof srvx.serve>;
      });
      vi.spyOn(previewModule, "startPreview").mockResolvedValue({
        fetch: vi.fn(),
        close: vi.fn(),
      });
      vi.spyOn(process, "on").mockReturnValue(process);

      const args = await (typeof previewCommand.args === "function"
        ? previewCommand.args()
        : previewCommand.args);
      await previewCommand.run!({
        args: parseArgs(["--dir", rootDir], args!),
        rawArgs: [],
        cmd: previewCommand,
      });

      expect(serve).toHaveBeenCalledOnce();
    }
  );

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
