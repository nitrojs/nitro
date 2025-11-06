import { prettyPath, resolveNitroPath } from "../../utils/fs.ts";
import { pkgDir, runtimeDir } from "nitro/runtime/meta";
import type { NitroOptions } from "nitro/types";
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
    (await findWorkspaceDir(options.rootDir).catch(() => options.rootDir)) +
    "/";

  if (options.srcDir) {
    if (options.serverDir === undefined) {
      options.serverDir = options.srcDir;
    }
    consola.warn(
      `"srcDir" option is deprecated. Please use "serverDir" instead.`
    );
  }

  if (options.serverDir !== false) {
    if ((options as any).serverDir === true) {
      options.serverDir = "server";
    }
    options.serverDir =
      resolve(options.rootDir, options.serverDir || ".") + "/";
  }

  options.alias ??= {};

  // Resolve possibly template paths
  if (!options.static && !options.entry) {
    throw new Error(
      `Nitro entry is missing! Is "${options.preset}" preset correct?`
    );
  }
  if (options.entry) {
    options.entry = resolveNitroPath(options.entry, options);
  }
  options.output.dir =
    resolveNitroPath(
      options.output.dir || NitroDefaults.output!.dir!,
      options,
      options.rootDir
    ) + "/";
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

  options.nodeModulesDirs.push(resolve(options.rootDir, "node_modules"));
  options.nodeModulesDirs.push(resolve(options.workspaceDir, "node_modules"));
  options.nodeModulesDirs.push(resolve(pkgDir, "dist/node_modules"));
  options.nodeModulesDirs.push(resolve(pkgDir, "node_modules"));
  options.nodeModulesDirs.push(resolve(pkgDir, "..")); // pnpm
  options.nodeModulesDirs = [
    ...new Set(
      // Adding trailing slash to optimize resolve performance (path is explicitly a dir)
      options.nodeModulesDirs.map((dir) => resolve(options.rootDir, dir) + "/")
    ),
  ];

  // Resolve plugin paths
  options.plugins = options.plugins.map((p) => resolveNitroPath(p, options));

  // Resolve scanDirs
  if (options.serverDir) {
    options.scanDirs.unshift(options.serverDir);
  }
  options.scanDirs = options.scanDirs.map((dir) =>
    resolve(options.rootDir, dir)
  );
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

  // Auto-detected server entry
  if (
    !options.routes["/**"] &&
    !options.handlers.some((h) => h.route === "/**")
  ) {
    const serverEntry = resolveModulePath("./server", {
      from: [options.rootDir, ...options.scanDirs],
      extensions: RESOLVE_EXTENSIONS,
      try: true,
    });
    if (serverEntry) {
      const alreadyRegistered =
        options.handlers.some((h) => h.handler === serverEntry) ||
        Object.values(options.routes).some(
          (r) => (r as { handler: string }).handler === serverEntry
        );
      if (!alreadyRegistered) {
        options.routes["/**"] = { handler: serverEntry };
        consola.info(
          `Using \`${prettyPath(serverEntry)}\` as default route handler.`
        );
      }
    }
  }

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
      consola.info(
        `Using \`${prettyPath(defaultIndex)}\` as renderer template.`
      );
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
