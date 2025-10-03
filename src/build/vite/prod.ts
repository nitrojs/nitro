import type { ViteBuilder } from "vite";
import type { NitroPluginContext } from "./types";

import { dirname, relative, resolve } from "pathe";
import { formatCompatibilityDate } from "compatx";
import { colors as C } from "consola/utils";
import { copyPublicAssets, prerender } from "../..";
import { existsSync, mkdirSync, rename, renameSync } from "node:fs";

const BuilderNames = {
  nitro: C.magenta("Nitro"),
  client: C.green("Client"),
  ssr: C.blue("SSR"),
} as Record<string, string>;

export async function buildEnvironments(
  ctx: NitroPluginContext,
  builder: ViteBuilder
) {
  const nitro = ctx.nitro!;

  // ----------------------------------------------
  // Stage 1: Build all environments before Nitro
  // ----------------------------------------------

  for (const [envName, env] of Object.entries(builder.environments)) {
    // prettier-ignore
    const fmtName = BuilderNames[envName] || (envName.length <= 3 ? envName.toUpperCase() : envName[0].toUpperCase() + envName.slice(1));
    if (
      envName === "nitro" ||
      !env.config.build.rollupOptions.input ||
      env.isBuilt
    ) {
      if (!["nitro", "ssr", "client"].includes(envName)) {
        nitro.logger.info(
          env.isBuilt
            ? `Skipping ${fmtName} (already built)`
            : `Skipping ${fmtName} (no input defined)`
        );
      }
      continue;
    }
    console.log();
    nitro.logger.start(`Building [${fmtName}]`);
    await builder.build(env);
  }

  // Use transformed client input for index.html generation
  const nitroOptions = ctx.nitro!.options;
  const clientInput =
    builder.environments.client?.config?.build?.rollupOptions?.input;
  if (nitroOptions.indexHTML && nitroOptions.indexHTML === clientInput) {
    const outputPath = resolve(nitroOptions.output.publicDir, "index.html");
    if (existsSync(outputPath)) {
      const tmp = resolve(nitroOptions.buildDir, "vite/index.html");
      mkdirSync(dirname(tmp), { recursive: true });
      renameSync(outputPath, tmp);
      nitroOptions.indexHTML = tmp;
    }
  }

  // ----------------------------------------------
  // Stage 2: Build Nitro
  // ----------------------------------------------

  console.log();
  const buildInfo = [
    ["preset", nitro.options.preset],
    ["compatibility", formatCompatibilityDate(nitro.options.compatibilityDate)],
  ].filter((e) => e[1]);
  nitro.logger.start(
    `Building [${BuilderNames.nitro}] ${C.dim(`(${buildInfo.map(([k, v]) => `${k}: \`${v}\``).join(", ")})`)}`
  );

  // Copy public assets to the final output directory
  await copyPublicAssets(nitro);

  // Prerender routes if configured
  // TODO
  // await prerender(nitro);

  // Call the rollup:before hook for compatibility
  await nitro.hooks.callHook(
    "rollup:before",
    nitro,
    builder.environments.nitro.config.build.rollupOptions as any
  );

  // Build the Nitro server bundle
  await builder.build(builder.environments.nitro);

  // Close the Nitro instance
  await nitro.close();

  // Call compiled hook
  await nitro.hooks.callHook("compiled", nitro);

  // Show deploy and preview commands
  const rOutput = relative(process.cwd(), nitro.options.output.dir);
  const rewriteRelativePaths = (input: string) => {
    return input.replace(/([\s:])\.\/(\S*)/g, `$1${rOutput}/$2`);
  };

  console.log();
  if (nitro.options.commands.preview) {
    nitro.logger.success(
      `You can preview this build using \`${rewriteRelativePaths(
        nitro.options.commands.preview
      )}\``
    );
  }
  if (nitro.options.commands.deploy) {
    nitro.logger.success(
      `You can deploy this build using \`${rewriteRelativePaths(
        nitro.options.commands.deploy
      )}\``
    );
  }
}

export function prodEntry(ctx: NitroPluginContext): string {
  const services = ctx.pluginConfig.services || {};
  const serviceNames = Object.keys(services);
  const result = [
    // Fetchable services
    `const services = { ${serviceNames.map((name) => {
      let entry: string;
      if (ctx.pluginConfig.experimental?.virtualBundle) {
        entry = ctx._entryPoints[name];
      } else {
        entry = resolve(
          ctx.nitro!.options.buildDir,
          "vite/services",
          name,
          ctx._entryPoints[name]
        );
      }
      return `[${JSON.stringify(name)}]: () => import("${entry}")`;
    })}};`,
    /* js */ `
              const serviceHandlers = {};
              const originalFetch = globalThis.fetch;
              globalThis.fetch = (input, init) => {
                const { viteEnv } = init || {};
                if (!viteEnv) {
                  return originalFetch(input, init);
                }
                if (typeof input === "string" && input[0] === "/") {
                  input = new URL(input, "http://localhost");
                }
                const req = new Request(input, init);
                if (serviceHandlers[viteEnv]) {
                  return Promise.resolve(serviceHandlers[viteEnv](req));
                }
                if (!services[viteEnv]) {
                  return new Response("Service not found: " + viteEnv, { status: 404 });
                }
                return services[viteEnv]().then((mod) => {
                  const fetchHandler = mod.fetch || mod.default?.fetch;
                  serviceHandlers[viteEnv] = fetchHandler;
                  return fetchHandler(req);
                });
              };
            `,
    // TODO: expose resolveEntry utility to resolve entry points
    // SSR Manifest
    ctx._manifest
      ? `globalThis.__VITE_MANIFEST__ = ${JSON.stringify(ctx._manifest)};`
      : "",
  ].join("\n");
  return result;
}
