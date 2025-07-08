import type { ViteBuilder } from "vite";
import type { RollupOutput, OutputChunk } from "rollup";
import type { NitroPluginContext } from "./plugin";

import { relative, resolve } from "node:path";
import { readFile, rm } from "node:fs/promises";
import { formatCompatibilityDate } from "compatx";
import { copyPublicAssets, prerender } from "../..";
import { nitroServerName } from "../../utils/nitro";

export async function buildProduction(
  ctx: NitroPluginContext,
  builder: ViteBuilder
) {
  const nitro = ctx.nitro!;

  // Vite generates public/.vite/manifest.json, for each environment
  // We need to collect it progressively
  ctx._manifest = {};
  const manifestPath = resolve(
    nitro.options.output.publicDir,
    ".vite/manifest.json"
  );
  const collectManifest = async () => {
    Object.assign(
      ctx._manifest!,
      await readFile(manifestPath, "utf8")
        .catch(() => "{}")
        .then((r) => JSON.parse(r))
    );
  };

  // Build all environments before to the final Nitro server bundle
  ctx._buildResults = {};
  for (const [name, env] of Object.entries(builder.environments)) {
    // prettier-ignore
    const fmtName = name.length <= 3 ? name.toUpperCase() : name[0].toUpperCase() + name.slice(1);
    if (name === "nitro") continue;
    if (!env.config.build.rollupOptions.input) {
      // If the environment is a server environment and has no input, skip it
      nitro.logger.warn(
        `Skipping build for \`${fmtName}\` as it has no input.`
      );
      continue;
    }
    nitro.logger.start(`Building \`${fmtName}\`...`);
    ctx._buildResults![name] = ((await builder.build(env)) as RollupOutput)
      .output[0] as OutputChunk;
    await collectManifest();
  }

  nitro.logger.start(
    `Building \`${nitroServerName(nitro)}\` (preset: \`${nitro.options.preset}\`, compatibility date: \`${formatCompatibilityDate(nitro.options.compatibilityDate)}\`)`
  );

  // Call the rollup:before hook for compatibility
  await nitro.hooks.callHook(
    "rollup:before",
    nitro,
    builder.environments.nitro.config.build.rollupOptions as any
  );

  // Copy public assets to the final output directory
  await copyPublicAssets(nitro);

  // Prerender routes if configured
  await prerender(nitro);

  // Build the Nitro server bundle
  await builder.build(builder.environments.nitro);
  await collectManifest();
  await rm(manifestPath, { force: true });

  // Close the Nitro instance
  await nitro.close();

  // Call compiled hook
  await nitro.hooks.callHook("compiled", nitro);

  // Show deploy and preview commands
  const rOutput = relative(process.cwd(), nitro.options.output.dir);
  const rewriteRelativePaths = (input: string) => {
    return input.replace(/([\s:])\.\/(\S*)/g, `$1${rOutput}/$2`);
  };
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
  return [
    // Fetchable services
    `const services = { ${serviceNames.map((name) => `[${JSON.stringify(name)}]: () => import("${resolve(ctx.nitro!.options.buildDir, "vite/services", name, ctx._buildResults![name].fileName)}")`)}};`,
    /* js */ `
              const serviceHandlers = {};
              const originalFetch = globalThis.fetch;
              globalThis.fetch = (input, init) => {
                if (!init?.env) {
                  return originalFetch(input, init);
                }
                if (typeof input === "string" && input[0] === "/") {
                  input = new URL(input, "http://localhost");
                }
                const req = new Request(input, init);
                if (serviceHandlers[init.env]) {
                  return Promise.resolve(serviceHandlers[init.env](req));
                }
                if (!services[init.env]) {
                  return new Response("Service not found: " + init.env, { status: 404 });
                }
                return services[init.env]().then((mod) => {
                  const fetchHandler = mod.fetch || mod.default?.fetch;
                  serviceHandlers[init.env] = fetchHandler;
                  return fetchHandler(req);
                });
              };
            `,
    // SSR Manifest
    ctx._manifest
      ? `globalThis.__VITE_MANIFEST__ = ${JSON.stringify(ctx._manifest)};`
      : "",
  ].join("\n");
}
