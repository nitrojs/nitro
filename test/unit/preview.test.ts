import { EventEmitter } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import consola from "consola";
import { join } from "pathe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startPreview, type PreviewInstance } from "../../src/preview.ts";

const spawnMock = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return { ...actual, spawn: spawnMock };
});

const getRandomPortMock = vi.hoisted(() => vi.fn());
const waitForPortMock = vi.hoisted(() => vi.fn());
vi.mock("get-port-please", () => ({
  getRandomPort: getRandomPortMock,
  waitForPort: waitForPortMock,
}));

type FakeChild = EventEmitter & {
  killed: boolean;
  pid?: number;
  exitCode: number | null;
  signalCode: NodeJS.Signals | null;
  kill: ReturnType<typeof vi.fn>;
  emitExit: (code?: number, signal?: NodeJS.Signals | null) => void;
};

function createFakeChild(): FakeChild {
  const child = new EventEmitter() as FakeChild;
  child.killed = false;
  child.exitCode = null;
  child.signalCode = null;
  child.kill = vi.fn(() => {
    child.killed = true;
    return true;
  });
  child.emitExit = (code = 0, signal: NodeJS.Signals | null = null) => {
    child.exitCode = code;
    child.signalCode = signal;
    child.emit("exit", code, signal);
  };
  return child;
}

describe("preview", () => {
  let rootDir: string;
  const activePreviews: { preview: PreviewInstance; child: FakeChild }[] = [];

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), "nitro-preview-"));
    await writeFile(join(rootDir, "nitro.config.mjs"), "export default {};");
    spawnMock.mockReset();
    getRandomPortMock.mockReset().mockResolvedValue(34_567);
    waitForPortMock.mockReset().mockResolvedValue(undefined);
    vi.spyOn(consola, "box").mockImplementation(() => {});
    vi.spyOn(consola, "info").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(async () => {
    for (const { preview, child } of activePreviews.splice(0)) {
      const closed = preview.close();
      child.emitExit(0);
      await closed;
    }
    vi.useRealTimers();
    vi.restoreAllMocks();
    await rm(rootDir, { recursive: true, force: true });
  });

  async function writeBuild(
    opts: { preset?: string; date?: Date; commands?: Record<string, string> } = {}
  ) {
    const date = opts.date ?? new Date(Date.now() + 60_000);
    await mkdir(join(rootDir, ".output"), { recursive: true });
    await writeFile(
      join(rootDir, ".output/nitro.json"),
      JSON.stringify({
        date: date.toJSON(),
        preset: opts.preset ?? "node-server",
        versions: { nitro: "3" },
        ...(opts.commands ? { commands: opts.commands } : {}),
      })
    );
  }

  async function writeWranglerPackage(pkg: { bin?: string | Record<string, string> }) {
    const pkgDir = join(rootDir, "node_modules/wrangler");
    await mkdir(join(pkgDir, "bin"), { recursive: true });
    await writeFile(join(pkgDir, "package.json"), JSON.stringify(pkg));
    await writeFile(join(pkgDir, "bin/wrangler.js"), "");
  }

  async function writeInvalidWranglerPackage() {
    const pkgDir = join(rootDir, "node_modules/wrangler");
    await mkdir(pkgDir, { recursive: true });
    await writeFile(join(pkgDir, "package.json"), "{ not valid json");
  }

  async function startCloudflarePreview(command = "npx wrangler dev") {
    await writeBuild({ preset: "cloudflare-module", commands: { preview: command } });
    const child = createFakeChild();
    spawnMock.mockReturnValue(child);
    const preview = await startPreview({ rootDir });
    activePreviews.push({ preview, child });
    return { preview, child };
  }

  it("warns when the config changed after the build", async () => {
    await writeBuild({ date: new Date(Date.now() - 60_000) });
    const warn = vi.spyOn(consola, "warn").mockImplementation(() => {});
    const preview = await startPreview({ rootDir });
    await preview.close();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("`nitro.config.mjs` changed after"));
  });

  it("does not warn for a build newer than the config", async () => {
    await writeBuild({ date: new Date(Date.now() + 60_000) });
    const warn = vi.spyOn(consola, "warn").mockImplementation(() => {});
    const preview = await startPreview({ rootDir });
    await preview.close();
    expect(warn).not.toHaveBeenCalled();
  });

  it("spawns the local wrangler bin with process.execPath", async () => {
    await writeWranglerPackage({ bin: "./bin/wrangler.js" });
    await startCloudflarePreview();
    expect(spawnMock).toHaveBeenCalledTimes(1);
    const [command, args, options] = spawnMock.mock.calls[0];
    expect(command).toBe(process.execPath);
    expect(args).toEqual([
      join(rootDir, "node_modules/wrangler/bin/wrangler.js"),
      "dev",
      "--port",
      "34567",
      "--host",
      "localhost",
    ]);
    expect(options).toEqual(
      expect.objectContaining({ stdio: "inherit", cwd: rootDir, env: expect.anything() })
    );
  });

  it("picks bin.wrangler from an object bin field", async () => {
    await writeWranglerPackage({
      bin: { cf: "./bin/cf.js", wrangler: "./bin/wrangler.js" },
    });
    await startCloudflarePreview();
    expect(spawnMock.mock.calls[0][0]).toBe(process.execPath);
    expect(spawnMock.mock.calls[0][1][0]).toBe(
      join(rootDir, "node_modules/wrangler/bin/wrangler.js")
    );
  });

  it("supports a string bin field", async () => {
    await writeWranglerPackage({ bin: "./bin/wrangler.js" });
    await startCloudflarePreview();
    expect(spawnMock.mock.calls[0][0]).toBe(process.execPath);
    expect(spawnMock.mock.calls[0][1][0]).toBe(
      join(rootDir, "node_modules/wrangler/bin/wrangler.js")
    );
  });

  it("falls back to npx with one warning when wrangler is not installed", async () => {
    const warn = vi.spyOn(consola, "warn").mockImplementation(() => {});
    await startCloudflarePreview();
    expect(spawnMock).toHaveBeenCalledWith(
      "npx",
      ["wrangler", "dev", "--port", "34567", "--host", "localhost"],
      expect.objectContaining({ cwd: rootDir })
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("pnpm add -D wrangler");
  });

  it("falls back to npx when the package has no bin entry", async () => {
    const warn = vi.spyOn(consola, "warn").mockImplementation(() => {});
    await writeWranglerPackage({});
    await startCloudflarePreview();
    expect(spawnMock.mock.calls[0][0]).toBe("npx");
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("falls back to npx when package metadata is invalid", async () => {
    const warn = vi.spyOn(consola, "warn").mockImplementation(() => {});
    await writeInvalidWranglerPackage();
    await startCloudflarePreview();
    expect(spawnMock.mock.calls[0][0]).toBe("npx");
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("leaves non-wrangler commands unchanged", async () => {
    const warn = vi.spyOn(consola, "warn").mockImplementation(() => {});
    const { child } = await startCloudflarePreview("npx some-other-cli dev");
    expect(spawnMock.mock.calls[0][0]).toBe("npx");
    expect(spawnMock.mock.calls[0][1]).toEqual([
      "some-other-cli",
      "dev",
      "--port",
      "34567",
      "--host",
      "localhost",
    ]);
    expect(warn).not.toHaveBeenCalled();
    expect(child.kill).not.toHaveBeenCalled();
  });

  it("close waits for the child to exit", async () => {
    await writeWranglerPackage({ bin: "./bin/wrangler.js" });
    const { preview, child } = await startCloudflarePreview();
    let closed = false;
    const closing = preview.close().then(() => {
      closed = true;
    });
    await Promise.resolve();
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
    expect(closed).toBe(false);
    child.emitExit(0);
    await closing;
    expect(closed).toBe(true);
  });

  it("shares one close promise between concurrent calls", async () => {
    await writeWranglerPackage({ bin: "./bin/wrangler.js" });
    const { preview, child } = await startCloudflarePreview();
    const first = preview.close();
    const second = preview.close();
    expect(second).toBe(first);
    child.emitExit(0);
    await Promise.all([first, second]);
    expect(child.kill).toHaveBeenCalledTimes(1);
  });

  it("does not signal an already exited child", async () => {
    await writeWranglerPackage({ bin: "./bin/wrangler.js" });
    const { preview, child } = await startCloudflarePreview();
    child.emitExit(0);
    await preview.close();
    expect(child.kill).not.toHaveBeenCalled();
  });

  it("settles close and logs the error when the child fails to spawn", async () => {
    await writeWranglerPackage({ bin: "./bin/wrangler.js" });
    const error = vi.spyOn(consola, "error").mockImplementation(() => {});
    const sigint = process.listenerCount("SIGINT");
    const sighup = process.listenerCount("SIGHUP");
    const { preview, child } = await startCloudflarePreview();
    child.emit("error", new Error("spawn ENOENT"));
    await expect(preview.close()).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(expect.stringContaining("spawn ENOENT"));
    expect(child.kill).not.toHaveBeenCalled();
    expect(process.listenerCount("SIGINT")).toBe(sigint);
    expect(process.listenerCount("SIGHUP")).toBe(sighup);
  });

  it("does not settle close when killing the child fails", async () => {
    await writeWranglerPackage({ bin: "./bin/wrangler.js" });
    const error = vi.spyOn(consola, "error").mockImplementation(() => {});
    const { preview, child } = await startCloudflarePreview();
    child.pid = 12_345;
    child.emit("error", new Error("kill EPERM"));
    expect(error).toHaveBeenCalledWith(expect.stringContaining("kill EPERM"));
    let closed = false;
    const closing = preview.close().then(() => {
      closed = true;
    });
    await new Promise((resolve) => setImmediate(resolve));
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
    expect(closed).toBe(false);
    child.emitExit(0);
    await closing;
    expect(closed).toBe(true);
  });

  it("escalates to SIGKILL after five seconds", async () => {
    await writeWranglerPackage({ bin: "./bin/wrangler.js" });
    const { preview, child } = await startCloudflarePreview();
    vi.useFakeTimers();
    let closed = false;
    const closing = preview.close().then(() => {
      closed = true;
    });
    await vi.advanceTimersByTimeAsync(4999);
    expect(child.kill).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(child.kill).toHaveBeenNthCalledWith(2, "SIGKILL");
    expect(closed).toBe(false);
    child.emitExit(0, "SIGKILL");
    await closing;
    vi.useRealTimers();
  });

  it("resolves close with a warning if the child ignores SIGKILL", async () => {
    await writeWranglerPackage({ bin: "./bin/wrangler.js" });
    const error = vi.spyOn(consola, "error").mockImplementation(() => {});
    const { preview, child } = await startCloudflarePreview();
    vi.useFakeTimers();
    let closed = false;
    const closing = preview.close().then(() => {
      closed = true;
    });
    await vi.advanceTimersByTimeAsync(5000);
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
    expect(child.kill).toHaveBeenCalledWith("SIGKILL");
    await vi.advanceTimersByTimeAsync(5000);
    await closing;
    expect(closed).toBe(true);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("did not exit after SIGKILL"));
    vi.useRealTimers();
  });

  it("cleans up the child when startup times out", async () => {
    await writeBuild({ preset: "cloudflare-module", commands: { preview: "npx wrangler dev" } });
    const child = createFakeChild();
    child.pid = 12_345;
    spawnMock.mockReturnValue(child);
    let rejectPort: ((error: Error) => void) | undefined;
    waitForPortMock.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectPort = reject;
        })
    );
    const sigint = process.listenerCount("SIGINT");
    const sighup = process.listenerCount("SIGHUP");
    const previewPromise = startPreview({ rootDir }).catch((error) => error);
    await vi.waitFor(() => expect(waitForPortMock).toHaveBeenCalled(), { timeout: 5000 });
    rejectPort?.(new Error("Timed out waiting for port"));
    await vi.waitFor(() => expect(child.kill).toHaveBeenCalledWith("SIGTERM"), { timeout: 5000 });
    child.emitExit(0, "SIGTERM");
    const result = await previewPromise;
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toContain("Timed out waiting for port");
    expect(process.listenerCount("SIGINT")).toBe(sigint);
    expect(process.listenerCount("SIGHUP")).toBe(sighup);
  });

  it("logs a non-zero exit code", async () => {
    await writeWranglerPackage({ bin: "./bin/wrangler.js" });
    const error = vi.spyOn(consola, "error").mockImplementation(() => {});
    const { preview, child } = await startCloudflarePreview();
    child.emitExit(1);
    await preview.close();
    expect(error).toHaveBeenCalledWith("[nitro] Preview server exited with code 1");
  });

  it("forwards process signals to the running child", async () => {
    await writeWranglerPackage({ bin: "./bin/wrangler.js" });
    const sigintBefore = process.listeners("SIGINT");
    const sighupBefore = process.listeners("SIGHUP");
    const { preview, child } = await startCloudflarePreview();
    const sigintListener = process
      .listeners("SIGINT")
      .find((fn) => !sigintBefore.includes(fn)) as () => void;
    const sighupListener = process
      .listeners("SIGHUP")
      .find((fn) => !sighupBefore.includes(fn)) as () => void;
    sigintListener();
    expect(child.kill).toHaveBeenCalledWith("SIGINT");
    sighupListener();
    expect(child.kill).toHaveBeenCalledWith("SIGHUP");
    const closing = preview.close();
    child.emitExit(0);
    await closing;
  });

  it("restores SIGINT/SIGHUP listeners after close", async () => {
    await writeWranglerPackage({ bin: "./bin/wrangler.js" });
    const sigint = process.listenerCount("SIGINT");
    const sighup = process.listenerCount("SIGHUP");
    const { preview, child } = await startCloudflarePreview();
    expect(process.listenerCount("SIGINT")).toBe(sigint + 1);
    expect(process.listenerCount("SIGHUP")).toBe(sighup + 1);
    const closing = preview.close();
    child.emitExit(0);
    await closing;
    expect(process.listenerCount("SIGINT")).toBe(sigint);
    expect(process.listenerCount("SIGHUP")).toBe(sighup);
  });

  it("restores SIGINT/SIGHUP listeners when the child exits on its own", async () => {
    await writeWranglerPackage({ bin: "./bin/wrangler.js" });
    const sigint = process.listenerCount("SIGINT");
    const sighup = process.listenerCount("SIGHUP");
    const { preview, child } = await startCloudflarePreview();
    child.emitExit(0);
    await preview.close();
    expect(process.listenerCount("SIGINT")).toBe(sigint);
    expect(process.listenerCount("SIGHUP")).toBe(sighup);
  });
});
