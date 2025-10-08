import type { ViteBuilder } from "vite";
import type { NitroPluginContext } from "./types";

import { basename, dirname, relative, resolve } from "pathe";
import { formatCompatibilityDate } from "compatx";
import { colors as C } from "consola/utils";
import { copyPublicAssets } from "../..";
import { existsSync } from "node:fs";
import { runtimeDir } from "nitro/runtime/meta";
import { writeBuildInfo } from "../info";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";

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

  // Use transformed client input for renderer template generation
  const nitroOptions = ctx.nitro!.options;
  const clientInput =
    builder.environments.client?.config?.build?.rollupOptions?.input;
  if (
    nitroOptions.renderer?.template &&
    nitroOptions.renderer?.template === clientInput
  ) {
    const outputPath = resolve(
      nitroOptions.output.publicDir,
      basename(clientInput as string)
    );
    if (existsSync(outputPath)) {
      const html = await readFile(outputPath, "utf8").then((r) =>
        r.replace(
          "<!--ssr-outlet-->",
          `{{{ fetch($REQUEST, { viteEnv: "ssr" }) }}}`
        )
      );
      await rm(outputPath);
      const tmp = resolve(nitroOptions.buildDir, "vite/index.html");
      await mkdir(dirname(tmp), { recursive: true });
      await writeFile(tmp, html, "utf8");
      nitroOptions.renderer.template = tmp;
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

  // Write build info
  await writeBuildInfo(nitro);

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

export function prodSetup(ctx: NitroPluginContext): string {
  const services = ctx.pluginConfig.services || {};
  const serviceNames = Object.keys(services);

  const serviceEntries = serviceNames.map((name) => {
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
    return [name, entry];
  });

  return /* js */ `
import { setupVite } from "${resolve(runtimeDir, "internal/vite/prod-setup.mjs")}";

const manifest = ${JSON.stringify(ctx._manifest || {})};

function lazyService(loader) {
  let promise, mod
  return {
    fetch(req) {
      if (mod) { return mod.fetch(req) }
      if (!promise) {
        promise = loader().then(_mod => (mod = _mod.default || _mod))
      }
      return promise.then(mod => mod.fetch(req))
    }
  }
}

const services = {
${serviceEntries
  .map(
    ([name, entry]) =>
      /* js */ `[${JSON.stringify(name)}]: lazyService(() => import(${JSON.stringify(entry)}))`
  )
  .join(",\n")}
};

setupVite({ manifest, services });
  `;
}
