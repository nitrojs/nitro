import type { Plugin as VitePlugin, PreviewServer } from "vite";
import type { NitroPluginContext } from "./types.ts";
import { spawn } from "node:child_process";
import consola from "consola";
import { prettyPath } from "../../utils/fs.ts";
import { getBuildInfo } from "../info.ts";
import { join, resolve } from "node:path";

export function nitroPreviewPlugin(ctx: NitroPluginContext): VitePlugin {
  return {
    name: "nitro:preview",
    apply: (_config, configEnv) => !!configEnv.isPreview,

    config(config) {
      return {
        preview: {
          port: config.preview?.port || 3000,
        },
      };
    },

    async configurePreviewServer(server) {
      const { outputDir, buildInfo } = await getBuildInfo(server.config.root);
      if (!buildInfo) {
        throw this.error("Cannot load nitro build info. Make sure to build first.");
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
      const dotEnvEntries = await loadPreviewDotEnv(server.config.root);
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
          throw this.error(
            `No nitro build preview command found for the "${buildInfo.preset}" preset.`
          );
        }
        await runPreviewCommand({
          server,
          command: buildInfo.commands.preview,
          cwd: server.config.root,
        });
        return;
      }

      // Import handler and use in-process function calling
      const { NodeRequest, sendNodeResponse } = await import("srvx/node");

      if (buildInfo.publicDir) {
        const { serveStatic } = await import("srvx/static");
        const staticHandler = serveStatic({ dir: join(outputDir, buildInfo.publicDir) });

        server.middlewares.use(async (req, res, next) => {
          const nodeReq = new NodeRequest({ req, res });
          const staticRes: Response | undefined = await staticHandler(
            nodeReq,
            () => undefined as any
          );
          if (staticRes) {
            await sendNodeResponse(res, staticRes);
          } else {
            next();
          }
        });
      }

      if (buildInfo.serverEntry) {
        const { loadServerEntry } = await import("srvx/loader");
        const entryPath = resolve(outputDir, buildInfo.serverEntry);
        const entry = await loadServerEntry({ entry: entryPath });
        if (entry.notFound || !entry.fetch) {
          throw new Error(`Cannot load nitro server entry: ${entryPath}`);
        }
        server.middlewares.use(async (req, res, next) => {
          const nodeReq = new NodeRequest({ req, res });
          await sendNodeResponse(res, await entry.fetch!(nodeReq));
        });
        return;
      }
    },
  } satisfies VitePlugin;
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
  server: PreviewServer;
  command: string;
  cwd: string;
  env?: [string, string][];
}) {
  const [arg0, ...args] = opts.command.split(" ");

  consola.info(`Spawning preview server...`);
  consola.info(opts.command);
  console.log("");

  const { getRandomPort, waitForPort } = await import("get-port-please");
  const randomPort = await getRandomPort();
  const child = spawn(arg0, [...args, "--port", String(randomPort)], {
    stdio: "inherit",
    cwd: opts.cwd,
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
      consola.info(`Stopping preview server...`);
      killChild(sig);
      process.exit();
    });
  }

  opts.server.httpServer.once("close", () => {
    killChild("SIGTERM");
  });

  child.once("exit", (code) => {
    if (code && code !== 0) {
      consola.error(`[nitro] Preview server exited with code ${code}`);
    }
  });

  const { createProxyServer } = await import("httpxy");
  const proxy = createProxyServer({
    target: `http://localhost:${randomPort}`,
  });

  opts.server.middlewares.use((req, res, next) => {
    if (child && !child.killed) {
      proxy.web(req, res).catch(next);
    } else {
      res.end(`Nitro preview server is not running.`);
    }
  });

  await waitForPort(randomPort, { retries: 20, delay: 500 });
}
