import { prettyPath, resolveNitroPath } from "../../utils/fs.ts";
import { runtimeDir } from "nitro/meta";
import type { NitroOptions, NitroConfig } from "nitro/types";
import { join, resolve } from "pathe";
import { findWorkspaceDir } from "pkg-types";
import { NitroDefaults } from "../defaults.ts";
import { resolveModulePath } from "exsolve";
import consola from "consola";

const RESOLVE_EXTENSIONS = [".ts", ".js", ".mts", ".mjs", ".tsx", ".jsx"];

export async function resolvePathOptions(options: NitroOptions) {
  options.rootDir = resolve(options.rootDir || ".") + "/";
  options.buildDir = resolve(options.rootDir, options.buildDir || ".") + "/";
  options.workspaceDir ||=
    (await findWorkspaceDir(options.rootDir).catch(() => options.rootDir)) + "/";

  if (options.srcDir) {
    if (options.serverDir === undefined) {
      options.serverDir = options.srcDir;
    }
    consola.warn(`"srcDir" option is deprecated. Please use "serverDir" instead.`);
  }

  if (options.serverDir !== false) {
    if ((options as any).serverDir === true) {
      options.serverDir = "server";
    }
    options.serverDir = resolve(options.rootDir, options.serverDir || ".") + "/";
  }

  options.alias ??= {};

  // Resolve possibly template paths
  if (!options.static && !options.entry) {
    throw new Error(`Nitro entry is missing! Is "${options.preset}" preset correct?`);
  }
  if (options.entry) {
    options.entry = resolveNitroPath(options.entry, options);
  }

  options.output.dir =
    resolveNitroPath(options.output.dir || NitroDefaults.output!.dir!, options, options.rootDir) +
    "/";
  options.output.publicDir =
    resolveNitroPath(
      options.output.publicDir || NitroDefaults.output!.publicDir!,
      options,
      options.rootDir
    ) + "/";
  options.output.serverDir =
    resolveNitroPath(
      options.output.serverDir || NitroDefaults.output!.serverDir!,
      options,
      options.rootDir
    ) + "/";

  // Resolve plugin paths
  options.plugins = options.plugins.map((p) => resolveNitroPath(p, options));

  // Resolve scanDirs
  if (options.serverDir) {
    options.scanDirs.unshift(options.serverDir);
  }
  options.scanDirs = options.scanDirs.map((dir) => resolve(options.rootDir, dir));
  options.scanDirs = [...new Set(options.scanDirs.map((dir) => dir + "/"))];

  // Resolve handler and route paths
  options.handlers = options.handlers.map((h) => {
    return {
      ...h,
      handler: resolveNitroPath(h.handler, options),
    };
  });
  options.routes = Object.fromEntries(
    Object.entries(options.routes).map(([route, h]) => {
      if (typeof h === "string") {
        h = { handler: h };
      }
      h.handler = resolveNitroPath(h.handler, options);
      return [route, h];
    })
  );

  // Server entry
  if (options.serverEntry !== false) {
    if (typeof options?.serverEntry === "string") {
      options.serverEntry = { handler: options.serverEntry };
    }
    if (options.serverEntry?.handler) {
      options.serverEntry.handler = resolveNitroPath(options.serverEntry.handler, options);
    } else {
      const detected = resolveModulePath("./server", {
        try: true,
        from: options.rootDir,
        extensions: RESOLVE_EXTENSIONS.flatMap((ext) => [ext, `.node${ext}`]),
      });
      if (detected) {
        options.serverEntry ??= { handler: "" };
        options.serverEntry.handler = detected;
        consola.info(`Detected \`${prettyPath(detected)}\` as server entry.`);
      }
    }
    if (options.serverEntry?.handler && !options.serverEntry?.format) {
      const isNode = /\.(node)\.\w+$/.test(options.serverEntry.handler);
      options.serverEntry.format = isNode ? "node" : "web";
    }
  }

  if ((options as NitroConfig).renderer === false) {
    // Skip (auto) resolve renderer,
    // and reset it to meet "NitroOptions" requirements
    options.renderer = undefined;
  } else {
    // Resolve renderer handler
    if (options.renderer?.handler) {
      options.renderer.handler = resolveModulePath(
        resolveNitroPath(options.renderer?.handler, options),
        {
          from: [options.rootDir, ...options.scanDirs],
          extensions: RESOLVE_EXTENSIONS,
        }
      );
    }

    // Resolve renderer template
    if (options.renderer?.template) {
      options.renderer.template = resolveModulePath(
        resolveNitroPath(options.renderer?.template, options),
        {
          from: [options.rootDir, ...options.scanDirs],
          extensions: [".html"],
        }
      )!;
    } else if (!options.renderer?.handler) {
      const defaultIndex = resolveModulePath("./index.html", {
        from: [options.rootDir, ...options.scanDirs],
        extensions: [".html"],
        try: true,
      });
      if (defaultIndex) {
        options.renderer ??= {};
        options.renderer.template = defaultIndex;
        consola.info(`Using \`${prettyPath(defaultIndex)}\` as renderer template.`);
      }
    }

    // Default renderer handler if template is set
    if (options.renderer?.template && !options.renderer?.handler) {
      options.renderer ??= {};
      options.renderer.handler = join(
        runtimeDir,
        "internal/routes/renderer-template" + (options.dev ? ".dev" : "")
      );
    }
  }
}
