import { execFileSync } from "node:child_process";
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
    } catch {
      return false;
    }
    // An exited process that its new parent has not reaped yet still has a pid
    try {
      const state = execFileSync("ps", ["-o", "stat=", "-p", String(pid)], { encoding: "utf8" });
      return !state.trim().startsWith("Z");
    } catch {
      return false; // Gone before `ps` ran
    }
  };

  async function writeCommandBuild(command: string) {
    await mkdir(join(rootDir, ".output"), { recursive: true });
    await writeFile(
      join(rootDir, ".output/nitro.json"),
      JSON.stringify({
        date: new Date(Date.now() + 60_000).toJSON(),
        preset: "cloudflare-module",
        versions: { nitro: "3" },
        commands: { preview: command },
      })
    );
  }

  async function closeShellPreview(
    serverSetup = "",
    check?: (serverPid: number) => void | Promise<void>
  ) {
    await writeCommandBuild("node launcher.mjs");
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

    const sigtermListeners = process.listenerCount("SIGTERM");
    const preview = await startPreview({ rootDir });
    const pid = Number(await readFile(join(rootDir, "server.pid"), "utf8"));
    try {
      // A SIGTERM listener would stop other handlers (like `signal-exit`) from exiting Nitro
      expect(process.listenerCount("SIGTERM")).toBe(sigtermListeners);
      await check?.(pid);
      await preview.close();
      expect(isRunning(pid)).toBe(false);
      await expect(preview.fetch(new Request("http://localhost/"))).rejects.toThrow();
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
    "kills processes that ignore SIGTERM",
    () => closeShellPreview(`process.on("SIGTERM", () => {});`),
    10_000
  );

  it.skipIf(process.platform === "win32")(
    "lets processes finish shutting down before killing them",
    async () => {
      await closeShellPreview(
        `process.on("SIGTERM", () => setTimeout(() => { writeFileSync("stopped", ""); process.exit(0); }, 1000));`
      );
      await expect(readFile(join(rootDir, "stopped"), "utf8")).resolves.toBe("");
    }
  );

  it.skipIf(process.platform === "win32")("keeps the preview in Nitro's process group", () =>
    closeShellPreview("", (serverPid) => {
      const pgid = (pid: number) =>
        execFileSync("ps", ["-o", "pgid=", "-p", String(pid)], { encoding: "utf8" }).trim();
      expect(pgid(serverPid)).toBe(pgid(process.pid));
    })
  );

  it("rejects when the preview command cannot be started", async () => {
    await writeCommandBuild("nitro-missing-preview-command");
    vi.spyOn(consola, "info").mockImplementation(() => {});
    const sigintListeners = process.listenerCount("SIGINT");

    await expect(startPreview({ rootDir })).rejects.toMatchObject({ code: "ENOENT" });
    expect(process.listenerCount("SIGINT")).toBe(sigintListeners);
  });
});
