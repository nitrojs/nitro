import type { ServerHandler, ServerRequest } from "srvx";
import type { LoadOptions } from "srvx/loader";
import { spawn } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import consola from "consola";
import { resolveModulePath } from "exsolve";
import { basename, dirname, join, resolve } from "pathe";
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
    for (const [key, val] of dotEnvEntries) {
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
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

  let command = arg0;
  let commandArgs = args;
  if (arg0 === "npx" && args[0] === "wrangler") {
    const wranglerBin = await resolveWranglerBin(opts.rootDir);
    if (wranglerBin) {
      command = process.execPath;
      commandArgs = [wranglerBin, ...args.slice(1)];
    } else {
      consola.warn(
        "Could not resolve the `wrangler` package for the preview command. Falling back to `npx wrangler`, which may leave orphaned processes after shutdown. Install `wrangler` in the project root (e.g. `pnpm add -D wrangler`) to avoid this."
      );
    }
  }

  consola.info(`Spawning preview server...`);
  consola.info(opts.command);
  console.log("");

  const { getRandomPort, waitForPort } = await import("get-port-please");
  const randomPort = await getRandomPort();
  const child = spawn(
    command,
    [...commandArgs, "--port", String(randomPort), "--host", "localhost"],
    {
      stdio: "inherit",
      cwd: opts.rootDir,
      env: {
        ...process.env,
        ...Object.fromEntries(opts.env ?? []),
        PORT: String(randomPort),
      },
    }
  );

  let exited = false;

  const isRunning = () => !exited && child.exitCode === null && child.signalCode === null;

  const forwardSignal = (signal: NodeJS.Signals) => {
    if (isRunning()) {
      child.kill(signal);
    }
  };

  const onSigint = () => forwardSignal("SIGINT");
  const onSighup = () => forwardSignal("SIGHUP");

  const removeSignalListeners = () => {
    process.off("SIGINT", onSigint);
    process.off("SIGHUP", onSighup);
  };

  const exitPromise = new Promise<void>((resolveExit) => {
    const settle = () => {
      exited = true;
      resolveExit();
    };
    child.once("exit", (code) => {
      settle();
      if (code && code !== 0) {
        consola.error(`[nitro] Preview server exited with code ${code}`);
      }
    });
    child.on("error", (error) => {
      if (child.pid === undefined) {
        settle();
        removeSignalListeners();
      }
      consola.error(
        `[nitro] Preview server error: ${error instanceof Error ? error.message : String(error)}`
      );
    });
  });

  const waitForExit = async (timeout = 5000) => {
    let timer: NodeJS.Timeout | undefined;
    await Promise.race([
      exitPromise,
      new Promise<void>((resolveTimeout) => {
        timer = setTimeout(resolveTimeout, timeout);
      }),
    ]);
    clearTimeout(timer);
  };

  const terminate = async () => {
    if (!isRunning()) return;
    child.kill("SIGTERM");
    await waitForExit();
    if (!isRunning()) return;
    child.kill("SIGKILL");
    await waitForExit();
    if (isRunning()) {
      consola.error("[nitro] Preview server did not exit after SIGKILL.");
    }
  };

  child.once("exit", removeSignalListeners);

  process.on("SIGINT", onSigint);
  process.on("SIGHUP", onSighup);

  try {
    await waitForPort(randomPort, { retries: 20, delay: 500, host: "localhost" });
  } catch (error) {
    removeSignalListeners();
    await terminate();
    throw error;
  }

  let closePromise: Promise<void> | undefined;

  const stop = async () => {
    await terminate();
  };

  return {
    fetch(req: ServerRequest) {
      return proxyFetch({ port: randomPort, host: "localhost" }, req);
    },
    async upgrade(req, socket, head, opts) {
      await proxyUpgrade({ port: randomPort, host: "localhost" }, req, socket, head, opts);
    },
    close() {
      return (closePromise ??= stop().finally(removeSignalListeners));
    },
  };
}

async function resolveWranglerBin(rootDir: string): Promise<string | undefined> {
  const pkgPath = resolveModulePath("wrangler/package.json", { from: rootDir, try: true });
  if (!pkgPath) {
    return;
  }
  const pkg = (await readFile(pkgPath, "utf8")
    .then(JSON.parse)
    .catch(() => undefined)) as { bin?: string | Record<string, string> } | undefined;
  const bin =
    typeof pkg?.bin === "string"
      ? pkg.bin
      : pkg?.bin && typeof pkg.bin === "object"
        ? pkg.bin.wrangler
        : undefined;
  return typeof bin === "string" ? resolve(dirname(pkgPath), bin) : undefined;
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
