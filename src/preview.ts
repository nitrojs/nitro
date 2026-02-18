import type { ServerHandler, ServerRequest } from "srvx";
import type { LoadOptions } from "srvx/loader";
import { spawn } from "node:child_process";
import consola from "consola";
import { join, resolve } from "pathe";
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

export async function startPreview(opts: {
  rootDir: string;
  loader?: LoadOptions;
}): Promise<PreviewInstance> {
  const { outputDir, buildInfo } = await getBuildInfo(opts.rootDir);
  if (!buildInfo) {
    throw new Error("Cannot load nitro build info. Make sure to build first.");
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
    const { serveStatic } = await import("srvx/static");
    const staticHandler = serveStatic({ dir: join(outputDir, buildInfo.publicDir) });
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

  const killChild = (signal: NodeJS.Signals) => {
    if (child && !child.killed) {
      child.kill(signal);
    }
  };

  for (const sig of ["SIGINT", "SIGHUP"] as const) {
    process.once(sig, () => {
      killChild(sig);
    });
  }

  child.once("exit", (code) => {
    if (code && code !== 0) {
      consola.error(`[nitro] Preview server exited with code ${code}`);
    }
  });

  await waitForPort(randomPort, { retries: 20, delay: 500, host: "localhost" });

  return {
    fetch(req: ServerRequest) {
      return proxyFetch({ port: randomPort, host: "localhost" }, req);
    },
    async upgrade(req, socket, head, opts) {
      await proxyUpgrade({ port: randomPort, host: "localhost" }, req, socket, head, opts);
    },
    async close() {
      killChild("SIGTERM");
    },
  };
}
