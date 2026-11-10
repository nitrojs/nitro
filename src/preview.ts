import type { ServerHandler, ServerRequest } from "srvx";
import type { LoadOptions } from "srvx/loader";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { stat } from "node:fs/promises";
import consola from "consola";
import { basename, join, resolve } from "pathe";
import { proxyFetch, proxyUpgrade, type ProxyUpgradeOptions } from "httpxy";
import { prettyPath } from "./utils/fs.ts";
import { getBuildInfo } from "./build/info.ts";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";

export interface PreviewInstance {
  fetch: ServerHandler;
  upgrade?: (
    req: IncomingMessage,
    socket: Duplex,
    head?: Buffer,
    opts?: ProxyUpgradeOptions
  ) => Promise<void>;
  close: () => Promise<void>;
}

export interface PreviewOptions {
  /** Project root directory (used to locate the build output and load `.env` files). */
  rootDir: string;
  /** Explicit build output directory, resolved relative to `rootDir` (defaults to the last build output). */
  outputDir?: string;
  loader?: LoadOptions;
}

export async function startPreview(opts: PreviewOptions): Promise<PreviewInstance> {
  const { outputDir, buildInfo } = await getBuildInfo({
    rootDir: opts.rootDir,
    outputDir: opts.outputDir,
  });

  if (!buildInfo) {
    throw new Error(
      "Cannot load nitro build info. Make sure to build first, or use `nitro start` to run the sources without a build."
    );
  }

  const info = [
    ["Build Directory:", prettyPath(outputDir)],
    ["Date:", buildInfo.date && new Date(buildInfo.date).toLocaleString()],
    ["Nitro Version:", buildInfo.versions.nitro],
    ["Nitro Preset:", buildInfo.preset],
    buildInfo.framework?.name !== "nitro" && [
      "Framework:",
      buildInfo.framework?.name +
        (buildInfo.framework?.version ? ` (v${buildInfo.framework.version})` : ""),
    ],
  ].filter((i) => i && i[1]) as [string, string][];
  consola.box({
    title: " [Build Info] ",
    message: info.map((i) => `- ${i[0]} ${i[1]}`).join("\n"),
  });

  if (buildInfo.date) {
    await warnOutdatedBuild(opts.rootDir, buildInfo.date);
  }

  // Load .env files for preview mode
  const dotEnvEntries = await loadPreviewDotEnv(opts.rootDir);
  if (dotEnvEntries.length > 0) {
    consola.box({
      title: " [Environment Variables] ",
      message: [
        "Loaded variables from .env files (preview mode only).",
        "Set platform environment variables for production:",
        ...dotEnvEntries.map(([key, val]) => ` - ${key}`),
      ].join("\n"),
    });
  }

  // Currently cloudflare preset strictly requires preview command
  if (buildInfo.preset.includes("cloudflare")) {
    if (!buildInfo.commands?.preview) {
      throw new Error(`No nitro build preview command found for the "${buildInfo.preset}" preset.`);
    }
    return await runPreviewCommand({
      command: buildInfo.commands.preview,
      rootDir: opts.rootDir,
      env: dotEnvEntries,
    });
  }

  let fetchHandler: ServerHandler = () =>
    Promise.resolve(new Response("Not Found", { status: 404 }));

  if (buildInfo.serverEntry) {
    setUnsetEnv(dotEnvEntries);
    const { loadServerEntry } = await import("srvx/loader");
    const entryPath = resolve(outputDir, buildInfo.serverEntry);
    const entry = await loadServerEntry({ entry: entryPath, ...opts.loader });
    if (entry.fetch) {
      fetchHandler = entry.fetch;
    }
  }

  if (buildInfo.publicDir) {
    const { staticMiddleware } = await import("srvx/static");
    const staticHandler = staticMiddleware({ dir: join(outputDir, buildInfo.publicDir) });
    const originalFetchHandler = fetchHandler;
    fetchHandler = async (req) => {
      const staticRes: Response | undefined = await staticHandler(req, () => undefined as any);
      if (staticRes) {
        return staticRes;
      }
      return originalFetchHandler(req);
    };
  }

  return {
    fetch: fetchHandler,
    async close() {
      // No-op for in-process preview for now
    },
  };
}

/** Load preview `.env` files and apply the variables that are not already set in `process.env`. */
export async function applyPreviewDotEnv(root: string): Promise<[string, string][]> {
  const entries = await loadPreviewDotEnv(root);
  setUnsetEnv(entries);
  return entries;
}

async function loadPreviewDotEnv(root: string): Promise<[string, string][]> {
  const { loadDotenv } = await import("c12");
  const env = await loadDotenv({
    cwd: root,
    fileName: [".env.preview", ".env.production", ".env"],
  });
  return Object.entries(env).filter(([_key, val]) => val) as [string, string][];
}

async function runPreviewCommand(opts: {
  command: string;
  rootDir: string;
  env: [string, string][];
}): Promise<PreviewInstance> {
  const [arg0, ...args] = opts.command.split(" ");

  consola.info(`Spawning preview server...`);
  consola.info(opts.command);
  console.log("");

  const { getRandomPort, waitForPort } = await import("get-port-please");
  const randomPort = await getRandomPort();
  const child = spawn(arg0, [...args, "--port", String(randomPort), "--host", "localhost"], {
    stdio: "inherit",
    cwd: opts.rootDir,
    env: {
      ...process.env,
      ...Object.fromEntries(opts.env ?? []),
      PORT: String(randomPort),
    },
  });

  const signals = ["SIGINT", "SIGHUP"] as const;
  const forwardSignal = (signal: NodeJS.Signals) => signalProcessTree(child, signal);
  // When Nitro exits or crashes without `close()` (a fatal signal skips this)
  const onExit = () => {
    try {
      signalProcessTree(child, "SIGTERM");
    } catch {
      // Nitro is exiting anyway
    }
  };
  const removeListeners = () => {
    for (const sig of signals) {
      process.off(sig, forwardSignal);
    }
    process.off("exit", onExit);
  };

  let stopping = false;
  const exited = new Promise<void>((resolve) => {
    child.once("exit", (code) => {
      removeListeners();
      if (code && !stopping) {
        consola.error(`[nitro] Preview server exited with code ${code}`);
      }
      resolve();
    });
  });

  // A command that cannot be started emits `error` and never `exit`
  await new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("spawn", () => {
      child.off("error", reject);
      resolve();
    });
  });
  child.on("error", (error) => consola.error("[nitro] Preview server error:", error));
  for (const sig of signals) {
    process.once(sig, forwardSignal);
  }
  process.once("exit", onExit);

  let stopped: Promise<void> | undefined;
  const stop = () => {
    stopped ??= (async () => {
      stopping = true;
      removeListeners();
      await stopProcessTree(child, exited);
    })();
    return stopped;
  };

  await waitForPort(randomPort, { retries: 20, delay: 500, host: "localhost" }).catch(
    async (error) => {
      await stop();
      throw error;
    }
  );

  return {
    fetch(req: ServerRequest) {
      return proxyFetch({ port: randomPort, host: "localhost" }, req);
    },
    async upgrade(req, socket, head, opts) {
      await proxyUpgrade({ port: randomPort, host: "localhost" }, req, socket, head, opts);
    },
    close: stop,
  };
}

const PREVIEW_CLOSE_TIMEOUT = 5000;
const PREVIEW_KILL_TIMEOUT = 1000;
const PREVIEW_CLOSE_POLL_INTERVAL = 100;

interface ProcessInfo {
  pid: number;
  ppid: number;
  /** Start time from `/proc/<pid>/stat` (Linux only), to notice a reused pid. */
  start?: string;
}

/**
 * Stops the preview command and every process it started.
 *
 * `npx` runs the command through `sh -c`, and `dash` does not forward signals,
 * so signalling the child alone leaves the actual server running. The tree is
 * listed before signalling because descendants are reparented once `npx` exits.
 * The command stays in Nitro's process group, so group-wide signals (Ctrl+C,
 * `timeout`, CI cancellation) still reach it if Nitro never calls `close()`.
 */
async function stopProcessTree(child: ChildProcess, exited: Promise<void>) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  if (process.platform === "win32") {
    child.kill("SIGTERM");
    await exited;
    return;
  }
  const tree = signalProcessTree(child, "SIGTERM");
  await waitForProcesses(tree, PREVIEW_CLOSE_TIMEOUT);
  signalProcesses(tree, "SIGKILL");
  await waitForProcesses(tree, PREVIEW_KILL_TIMEOUT);
  await exited;
}

async function waitForProcesses(processes: ProcessInfo[], timeout: number) {
  const deadline = Date.now() + timeout;
  while (processes.some(isRunning) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, PREVIEW_CLOSE_POLL_INTERVAL));
  }
}

/** Signals the child and everything below it; returns the processes it signalled. */
function signalProcessTree(child: ChildProcess, signal: NodeJS.Signals): ProcessInfo[] {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) {
    return [];
  }
  if (process.platform === "win32") {
    child.kill(signal);
    return [];
  }
  const tree = listProcessTree(child.pid);
  signalProcesses(tree, signal);
  return tree;
}

function listProcessTree(rootPid: number): ProcessInfo[] {
  const processes = listProcesses();
  const tree = processes.filter((proc) => proc.pid === rootPid);
  if (tree.length === 0) {
    return [{ pid: rootPid, ppid: 0 }];
  }
  for (let i = 0; i < tree.length; i++) {
    tree.push(...processes.filter((proc) => proc.ppid === tree[i].pid));
  }
  return tree;
}

function listProcesses(): ProcessInfo[] {
  try {
    if (process.platform === "linux") {
      return readdirSync("/proc").flatMap((name) => {
        const proc = /^\d+$/.test(name) ? readProcStat(Number(name)) : undefined;
        return proc ? [proc] : [];
      });
    }
    return execFileSync("ps", ["-A", "-o", "pid=,ppid="], { encoding: "utf8" })
      .split("\n")
      .map((line) => line.trim().split(/\s+/).map(Number))
      .filter(([pid, ppid]) => Number.isInteger(pid) && Number.isInteger(ppid))
      .map(([pid, ppid]) => ({ pid, ppid }));
  } catch {
    // Without `/proc` or `ps`, only the direct child can be signalled
    return [];
  }
}

function readProcStat(pid: number): (ProcessInfo & { state: string }) | undefined {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    // Fields after the command name, which is in parentheses and may contain spaces
    const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
    return { pid, ppid: Number(fields[1]), start: fields[19], state: fields[0] };
  } catch {
    return undefined; // The process has exited
  }
}

function isRunning(proc: ProcessInfo): boolean {
  if (process.platform === "linux") {
    const current = readProcStat(proc.pid);
    // A zombie has already exited; a new start time means the pid was reused
    return (
      current !== undefined &&
      current.state !== "Z" &&
      (proc.start === undefined || current.start === proc.start)
    );
  }
  try {
    process.kill(proc.pid, 0);
    return true;
  } catch {
    return false;
  }
}

function signalProcesses(processes: ProcessInfo[], signal: NodeJS.Signals) {
  for (const proc of processes) {
    if (!isRunning(proc)) {
      continue;
    }
    try {
      process.kill(proc.pid, signal);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") {
        throw error;
      }
    }
  }
}

/** Warn when the Nitro config changed after the build (e.g. switched to `builder: false`). */
async function warnOutdatedBuild(rootDir: string, buildDate: string) {
  const buildTime = new Date(buildDate).getTime();
  for (const ext of [".ts", ".mts", ".cts", ".js", ".mjs", ".cjs"]) {
    const configPath = join(rootDir, `nitro.config${ext}`);
    const mtime = await stat(configPath).then(
      (s) => s.mtimeMs,
      () => undefined
    );
    if (mtime !== undefined && mtime > buildTime) {
      consola.warn(
        `\`${basename(configPath)}\` changed after this build. Run \`nitro build\` again, or \`nitro start\` to run the sources without a build.`
      );
      return;
    }
  }
}

function setUnsetEnv(entries: [string, string][]) {
  for (const [key, val] of entries) {
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}
