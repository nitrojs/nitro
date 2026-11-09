import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { parseArgs, type ArgsDef } from "citty";
import consola from "consola";
import { join } from "pathe";
import * as srvx from "srvx";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import previewCommand from "../../src/cli/commands/preview.ts";
import { startPreview } from "../../src/preview.ts";

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

  it.each([undefined, "15432"])(
    "applies dotenv before constructing the CLI server with shell PORT=%s",
    async (port) => {
      vi.stubEnv("PORT", port);
      await writeFile(join(rootDir, ".env"), "PORT=14321\n");
      const serve = vi.mocked(srvx.serve).mockImplementation(() => {
        expect(process.env.PORT).toBe(port || "14321");
        return { serve: vi.fn() } as unknown as ReturnType<typeof srvx.serve>;
      });

      // No build output: startPreview throws after the server has been constructed
      await expect(
        previewCommand.run!({
          args: parseArgs(["--dir", rootDir], previewCommand.args as ArgsDef),
          rawArgs: [],
          cmd: previewCommand,
        })
      ).rejects.toThrow("Make sure to build first");

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

  const isRunning = (pid: number) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };

  async function closeShellPreview(serverSetup = "") {
    await mkdir(join(rootDir, ".output"), { recursive: true });
    await writeFile(
      join(rootDir, ".output/nitro.json"),
      JSON.stringify({
        date: new Date(Date.now() + 60_000).toJSON(),
        preset: "cloudflare-module",
        versions: { nitro: "3" },
        commands: { preview: "node launcher.mjs" },
      })
    );
    // like `npx` under `dash`: `sh` does not hand the signal on to the server
    await writeFile(
      join(rootDir, "launcher.mjs"),
      `import { spawn } from "node:child_process";
spawn("sh", ["-c", "node server.mjs; :"], { stdio: "inherit" });`
    );
    await writeFile(
      join(rootDir, "server.mjs"),
      `import { createServer } from "node:http";
import { writeFileSync } from "node:fs";
${serverSetup}
writeFileSync("server.pid", String(process.pid));
createServer((_req, res) => res.end("ok")).listen(Number(process.env.PORT));`
    );
    vi.spyOn(consola, "info").mockImplementation(() => {});

    const preview = await startPreview({ rootDir });
    const pid = Number(await readFile(join(rootDir, "server.pid"), "utf8"));
    try {
      await preview.close();
      await expect.poll(() => isRunning(pid), { timeout: 2000 }).toBe(false);
    } finally {
      if (isRunning(pid)) {
        process.kill(pid, "SIGKILL");
      }
    }
  }

  it.skipIf(process.platform === "win32")(
    "stops processes the preview command started under a shell",
    () => closeShellPreview()
  );

  it.skipIf(process.platform === "win32")(
    "kills processes in the group that ignore SIGTERM",
    () => closeShellPreview(`process.on("SIGTERM", () => {});`),
    10_000
  );
});
