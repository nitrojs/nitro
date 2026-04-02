import type { Nitro } from "nitro/types";
import type { Plugin } from "rollup";
import type { BaseBuildConfig } from "./config.ts";

import { virtualTemplates } from "./virtual/_all.ts";
import replace from "@rollup/plugin-replace";
import { unwasm } from "unwasm/plugin";
import { routeMeta } from "./plugins/route-meta.ts";
import { serverMain } from "./plugins/server-main.ts";
import { virtual, virtualDeps } from "./plugins/virtual.ts";
import { sourcemapMinify } from "./plugins/sourcemap-min.ts";
import { raw } from "./plugins/raw.ts";
import { externals } from "./plugins/externals.ts";
import { escapeRegExp } from "../utils/regex.ts";

export async function baseBuildPlugins(nitro: Nitro, base: BaseBuildConfig) {
  const plugins: Plugin[] = [];

  // Virtual
  const virtualPlugin = virtual(virtualTemplates(nitro, [...base.env.polyfill]));
  nitro.vfs = virtualPlugin.api.modules;
  plugins.push(virtualPlugin, virtualDeps());

  // Auto imports
  if (nitro.options.imports) {
    const unimportPlugin = await import("unimport/unplugin");
    plugins.push(unimportPlugin.default.rollup(nitro.options.imports) as Plugin);
  }

  // WASM loader
  if (nitro.options.wasm !== false) {
    plugins.push(unwasm(nitro.options.wasm || {}));
  }

  // Inject globalThis.__server_main__
  plugins.push(serverMain(nitro));

  // Raw Imports
  plugins.push(raw());

  // Route meta
  if (nitro.options.experimental.openAPI) {
    plugins.push(await routeMeta(nitro));
  }

  // Replace
  plugins.push(
    (replace as unknown as typeof replace.default)({
      preventAssignment: true,
      values: base.replacements,
    })
  );

  // Externals (require Node.js compatible resolution)
  if (nitro.options.node && nitro.options.noExternals !== true) {
    const isDevOrPrerender = nitro.options.dev || nitro.options.preset === "nitro-prerender";
    const { NodeNativePackages, NonBundleablePackages, FullTracePackages } = await import("nf3/db");
    const negated = new Set<string>();
    const userTraceDeps: (string | RegExp)[] = [];
    const userFullTrace: string[] = [];
    for (const d of nitro.options.traceDeps || []) {
      if (typeof d !== "string") {
        userTraceDeps.push(d);
      } else if (d === "!" || d === "*") {
        throw new Error(`Invalid traceDeps selector: "${d}"`);
      } else if (d.startsWith("!")) {
        negated.add(d.slice(1));
      } else if (d.endsWith("*")) {
        const name = d.slice(0, -1);
        userFullTrace.push(name);
        userTraceDeps.push(name);
      } else {
        userTraceDeps.push(d);
      }
    }
    const traceDeps = [
      ...new Set([...NodeNativePackages, ...NonBundleablePackages, ...userTraceDeps]),
    ].filter((d) => typeof d !== "string" || !negated.has(d));
    const tracePattern = traceDeps
      .map((d) => (d instanceof RegExp ? d.source : escapeRegExp(d)))
      .join("|");
    const fullTraceInclude = [...new Set([...FullTracePackages, ...userFullTrace])];
    plugins.push(
      externals({
        rootDir: nitro.options.rootDir,
        conditions: nitro.options.exportConditions!,
        exclude: [...base.noExternal],
        include: isDevOrPrerender || !tracePattern
          ? undefined
          : [
              new RegExp(
                `(?:^(?:${tracePattern})(?:[/\\\\])|[/\\\\]node_modules[/\\\\](?:${tracePattern})(?:[/\\\\]))`
              ),
            ],
        trace: isDevOrPrerender
          ? false
          : {
              outDir: nitro.options.output.serverDir,
              fullTraceInclude,
            },
      })
    );
  }

  // Sourcemap minify
  if (
    nitro.options.sourcemap &&
    !nitro.options.dev &&
    nitro.options.experimental.sourcemapMinify !== false
  ) {
    plugins.push(sourcemapMinify());
  }

  return plugins;
}
