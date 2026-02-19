import type { ViteBuilder } from "vite";
import type { NitroPluginContext } from "./types.ts";

import { basename, dirname, resolve } from "pathe";
import { formatCompatibilityDate } from "compatx";
import { colors as C } from "consola/utils";
import { copyPublicAssets } from "../../builder.ts";
import { existsSync } from "node:fs";
import { writeBuildInfo } from "../info.ts";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { isTest, isCI } from "std-env";
import type { RolldownOutput } from "rolldown";

const BuilderNames = {
  nitro: C.magenta("Nitro"),
  client: C.green("Client"),
  ssr: C.blue("SSR"),
} as Record<string, string>;

export async function buildEnvironments(ctx: NitroPluginContext, builder: ViteBuilder) {
  const nitro = ctx.nitro!;

  // ----------------------------------------------
  // Stage 1: Build all environments before Nitro
  // ----------------------------------------------

  for (const [envName, env] of Object.entries(builder.environments)) {
    // prettier-ignore
    const fmtName = BuilderNames[envName] || (envName.length <= 3 ? envName.toUpperCase() : envName[0].toUpperCase() + envName.slice(1));
    if (envName === "nitro" || !env.config.build.rollupOptions.input || env.isBuilt) {
      if (!["nitro", "ssr", "client"].includes(envName)) {
        nitro.logger.info(
          env.isBuilt
            ? `Skipping ${fmtName} (already built)`
            : `Skipping ${fmtName} (no input defined)`
        );
      }
      continue;
    }
    if (!isTest && !isCI) console.log();
    nitro.logger.start(`Building [${fmtName}]`);
    await builder.build(env);
  }

  // Use transformed client input for renderer template generation
  const nitroOptions = ctx.nitro!.options;
  const clientInput = builder.environments.client?.config?.build?.rollupOptions?.input;
  if (nitroOptions.renderer?.template && nitroOptions.renderer?.template === clientInput) {
    const outputPath = resolve(nitroOptions.output.publicDir, basename(clientInput as string));
    if (existsSync(outputPath)) {
      const html = await readFile(outputPath, "utf8").then((r) =>
        r.replace(
          "<!--ssr-outlet-->",
          `{{{ globalThis.__nitro_vite_envs__?.["ssr"]?.fetch($REQUEST) || "" }}}`
        )
      );
      await rm(outputPath);
      const tmp = resolve(nitroOptions.buildDir, "vite/index.html");
      await mkdir(dirname(tmp), { recursive: true });
      await writeFile(tmp, html, "utf8");
      nitroOptions.renderer.template = tmp;
    }
  }

  // Extended builder API by assets plugin
  // https://github.com/hi-ogawa/vite-plugins/pull/1288
  await builder.writeAssetsManifest?.();

  // ----------------------------------------------
  // Stage 2: Build Nitro
  // ----------------------------------------------

  if (!isTest && !isCI) console.log();
  const buildInfo = [
    ["preset", nitro.options.preset],
    ["compatibility", formatCompatibilityDate(nitro.options.compatibilityDate)],
  ].filter((e) => e[1]);
  nitro.logger.start(
    `Building [${BuilderNames.nitro}] ${C.dim(`(${buildInfo.map(([k, v]) => `${k}: \`${v}\``).join(", ")})`)}`
  );

  // Copy public assets to the final output directory
  await copyPublicAssets(nitro);

  // Add route rule for asset dirs
  const assetDirs = new Set(
    Object.values(builder.environments)
      .filter((env) => env.config.consumer === "client")
      .map((env) => env.config.build.assetsDir)
      .filter(Boolean) as string[]
  );
  for (const assetsDir of assetDirs) {
    if (!existsSync(resolve(nitro.options.output.publicDir, assetsDir))) {
      continue;
    }
    const rule = (ctx.nitro!.options.routeRules[`/${assetsDir}/**`] ??= {});
    if (!rule.headers?.["cache-control"]) {
      rule.headers = {
        ...rule.headers,
        "cache-control": `public, max-age=31536000, immutable`,
      };
    }
  }
  ctx.nitro!.routing.sync();

  // Prerender routes if configured
  // TODO
  // await prerender(nitro);

  // Build the Nitro server bundle
  const output = (await builder.build(builder.environments.nitro)) as RolldownOutput;

  // Close the Nitro instance
  await nitro.close();

  // Call compiled hook
  await nitro.hooks.callHook("compiled", nitro);

  // Write build info
  await writeBuildInfo(nitro, output);

  // Show deploy and preview commands
  if (!isTest && !isCI) console.log();
  nitro.logger.success("You can preview this build using `npx vite preview`");
  if (nitro.options.commands.deploy) {
    nitro.logger.success("You can deploy this build using `npx nitro deploy --prebuilt`");
  }
}

export function prodSetup(ctx: NitroPluginContext): string {
  const serviceNames = Object.keys(ctx.services);

  const serviceEntries = serviceNames.map((name) => {
    const entry = resolve(
      ctx.nitro!.options.buildDir,
      "vite/services",
      name,
      ctx._entryPoints[name]
    );
    return [name, entry];
  });

  return /* js */ `
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

globalThis.__nitro_vite_envs__ = services;
  `;
}
