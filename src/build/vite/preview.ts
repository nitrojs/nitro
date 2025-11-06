import type { Plugin as VitePlugin } from "vite";
import type { NitroBuildInfo } from "nitro/types";
import type { NitroPluginContext } from "./types.ts";

import { resolve } from "pathe";
import { existsSync } from "node:fs";
import { readFile, readlink } from "node:fs/promises";
import { getRandomPort } from "get-port-please";

import consola from "consola";
import { spawn } from "node:child_process";
import { prettyPath } from "../../utils/fs.ts";
import { createProxyServer } from "httpxy";

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
      const lastBuildPath = resolve(
        server.config.root,
        "node_modules/.nitro/last-build.json"
      );
      if (!existsSync(lastBuildPath)) {
        consola.warn(
          `[nitro] No build info found in ${prettyPath(lastBuildPath)}. Please build your project before previewing.\n`
        );
        return;
      }

      const { outputDir: relativeOutDir } = (await JSON.parse(
        await readFile(lastBuildPath, "utf8")
      )) as { outputDir: string };

      const realBuildDir = resolve(lastBuildPath, relativeOutDir);

      const buildInfoPath = resolve(realBuildDir, "nitro.json");
      if (!existsSync(buildInfoPath)) {
        consola.warn(
          `[nitro] No build info found in ${prettyPath(buildInfoPath)}. Please build your project before previewing.\n`
        );
        return;
      }

      consola.log(`Using build directory: ${prettyPath(realBuildDir)}`);

      const buildInfo = JSON.parse(
        await readFile(buildInfoPath, "utf8")
      ) as NitroBuildInfo;

      const info = [
        ["Build Directory:", prettyPath(realBuildDir)],
        ["Date:", buildInfo.date && new Date(buildInfo.date).toLocaleString()],
        ["Nitro Version:", buildInfo.versions.nitro],
        ["Nitro Preset:", buildInfo.preset],
        buildInfo.framework?.name !== "nitro" && [
          "Framework:",
          buildInfo.framework?.name +
            (buildInfo.framework?.version
              ? ` (v${buildInfo.framework.version})`
              : ""),
        ],
      ].filter((i) => i && i[1]) as [string, string][];
      consola.box({
        title: " [Build Info] ",
        message: info.map((i) => `- ${i[0]} ${i[1]}`).join("\n"),
      });

      if (!buildInfo.commands?.preview) {
        consola.warn("[nitro] No preview command found for this preset..");
        return;
      }

      const randomPort = await getRandomPort();
      consola.info(`Spawning preview server...`);

      const [command, ...args] = buildInfo.commands.preview.split(" ");

      let child: ReturnType<typeof spawn> | undefined;

      consola.info(buildInfo.commands?.preview);

      child = spawn(command, args, {
        stdio: "inherit",
        cwd: realBuildDir,
        env: {
          ...process.env,
          PORT: String(randomPort),
        },
      });
      process.on("exit", () => {
        child?.kill();
        child = undefined;
      });
      child.on("exit", (code) => {
        if (code && code !== 0) {
          consola.error(`[nitro] Preview server exited with code ${code}`);
        }
      });

      const proxy = createProxyServer({
        target: `http://localhost:${randomPort}`,
      });

      server.middlewares.use((req, res, next) => {
        if (child && !child.killed) {
          proxy.web(req, res).catch(next);
        } else {
          res.end(`Nitro preview server is not running.`);
        }
      });
    },
  } satisfies VitePlugin;
}

async function findLastBuildDir(root: string): Promise<void> {
  const lastBuildPath = resolve(root, "node_modules/.nitro/last-build.json");
  if (!existsSync(lastBuildPath)) {
    return;
  }

  const { outputDir: relativeOutDir } = await readFile(lastBuildPath, "utf8")
    .catch(() => "{}")
    .then((data) => JSON.parse(data));

  const realBuildDir = resolve(lastBuildPath, relativeOutDir);
}
