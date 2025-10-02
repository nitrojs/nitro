import type { ViteBuilder } from "vite";
import type { NitroPluginContext } from "./types";

import { relative, resolve } from "pathe";
import { formatCompatibilityDate } from "compatx";
import { copyPublicAssets, prerender } from "../..";
import { nitroServerName } from "../../utils/nitro";

export async function buildEnvironments(
  ctx: NitroPluginContext,
  builder: ViteBuilder
) {
  const nitro = ctx.nitro!;

  // Build all environments before the final Nitro server bundle
  for (const [name, env] of Object.entries(builder.environments)) {
    // prettier-ignore
    const fmtName = name.length <= 3 ? name.toUpperCase() : name[0].toUpperCase() + name.slice(1);
    if (
      name === "nitro" ||
      !env.config.build.rollupOptions.input ||
      env.isBuilt
    ) {
      if (!["nitro", "ssr", "client"].includes(name)) {
        nitro.logger.info(
          env.isBuilt
            ? `Skipping \`${fmtName}\` (already built)`
            : `Skipping \`${fmtName}\` (no input defined)`
        );
      }
      continue;
    }
    nitro.logger.start(`Building \`${fmtName}\`...`);
    await builder.build(env);
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
  // TODO
  // await prerender(nitro);

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
