import { resolve, join } from "pathe";
import { loadConfig, watchConfig, WatchConfigOptions } from "c12";
import { klona } from "klona/full";
import { camelCase } from "scule";
import { defu } from "defu";
import { resolveModuleExportNames } from "mlly";
import escapeRE from "escape-string-regexp";
import { withLeadingSlash, withoutTrailingSlash, withTrailingSlash } from "ufo";
import { isTest, isDebug, nodeMajorVersion, provider } from "std-env";
import { findWorkspaceDir } from "pkg-types";
import consola from "consola";
import { version } from "../package.json";
import {
  resolvePath,
  resolveFile,
  detectTarget,
  provideFallbackValues,
} from "./utils";
import type {
  NitroConfig,
  NitroOptions,
  NitroRouteConfig,
  NitroRouteRules,
  NitroRuntimeConfig,
} from "./types";
import { runtimeDir, pkgDir } from "./dirs";
import * as _PRESETS from "./presets";
import { nitroImports } from "./imports";

const NitroDefaults: NitroConfig = {
  // General
  debug: isDebug,
  timing: isDebug,
  logLevel: isTest ? 1 : 3,
  runtimeConfig: { app: {}, nitro: {} },
  appConfig: {},
  appConfigFiles: [],

  // Dirs
  scanDirs: [],
  buildDir: ".nitro",
  output: {
    dir: "{{ rootDir }}/.output",
    serverDir: "{{ output.dir }}/server",
    publicDir: "{{ output.dir }}/public",
  },

  // Features
  experimental: {},
  future: {},
  storage: {},
  devStorage: {},
  bundledStorage: [],
  publicAssets: [],
  serverAssets: [],
  plugins: [],
  tasks: {},
  imports: {
    exclude: [],
    dirs: [],
    presets: nitroImports,
    virtualImports: ["#imports"],
  },
  virtual: {},
  compressPublicAssets: false,
  ignore: [],

  // Dev
  dev: false,
  devServer: { watch: [] },
  watchOptions: { ignoreInitial: true },
  devProxy: {},

  // Logging
  logging: {
    compressedSizes: true,
    buildSuccess: true,
  },

  // Routing
  baseURL: process.env.NITRO_APP_BASE_URL || "/",
  handlers: [],
  devHandlers: [],
  errorHandler: "#internal/nitro/error",
  routeRules: {},
  prerender: {
    autoSubfolderIndex: true,
    concurrency: 1,
    interval: 0,
    retry: 3,
    retryDelay: 500,
    failOnError: false,
    crawlLinks: false,
    ignore: [],
    routes: [],
  },

  // Rollup
  alias: {
    "#internal/nitro": runtimeDir,
  },
  unenv: {},
  analyze: false,
  moduleSideEffects: [
    "unenv/runtime/polyfill/",
    "node-fetch-native/polyfill",
    "node-fetch-native/dist/polyfill",
    resolve(runtimeDir, "polyfill/"),
  ],
  replace: {},
  node: true,
  sourceMap: true,
  esbuild: {
    options: {
      jsxFactory: "h",
      jsxFragment: "Fragment",
    },
  },

  // Advanced
  typescript: {
    strict: false,
    generateTsConfig: true,
    tsconfigPath: "types/tsconfig.json",
    internalPaths: false,
    tsConfig: {},
  },
  nodeModulesDirs: [],
  hooks: {},
  commands: {},

  // Framework
  framework: {
    name: "nitro",
    version,
  },
};

export interface LoadConfigOptions {
  watch?: boolean;
  c12?: WatchConfigOptions;
}

export async function loadOptions(
  configOverrides: NitroConfig = {},
  opts: LoadConfigOptions = {}
): Promise<NitroOptions> {
  // Preset
  let presetOverride =
    (configOverrides.preset as string) ||
    process.env.NITRO_PRESET ||
    process.env.SERVER_PRESET;
  if (configOverrides.dev) {
    presetOverride = "nitro-dev";
  }

  // Load configuration and preset
  configOverrides = klona(configOverrides);
  // @ts-ignore
  globalThis.defineNitroConfig = globalThis.defineNitroConfig || ((c) => c);
  const c12Config = await (opts.watch ? watchConfig : loadConfig)(<
    WatchConfigOptions
  >{
    name: "nitro",
    cwd: configOverrides.rootDir,
    dotenv: configOverrides.dev,
    extend: { extendKey: ["extends", "preset"] },
    overrides: {
      ...configOverrides,
      preset: presetOverride,
    },
    defaultConfig: {
      preset: detectTarget({ static: configOverrides.static }),
    },
    defaults: NitroDefaults,
    jitiOptions: {
      alias: {
        nitropack: "nitropack/config",
        "nitropack/config": "nitropack/config",
      },
    },
    resolve(id: string) {
      const presets = _PRESETS as any as Map<string, NitroConfig>;
      let matchedPreset = presets[camelCase(id)] || presets[id];
      if (!matchedPreset) {
        return null;
      }
      if (typeof matchedPreset === "function") {
        matchedPreset = matchedPreset();
      }
      return {
        config: matchedPreset,
      };
    },
    ...opts.c12,
  });
  const options = klona(c12Config.config) as NitroOptions;
  options._config = configOverrides;
  options._c12 = c12Config;

  options.preset =
    presetOverride ||
    (c12Config.layers.find((l) => l.config.preset)?.config.preset as string) ||
    detectTarget({ static: options.static });

  options.rootDir = resolve(options.rootDir || ".");
  options.workspaceDir = await findWorkspaceDir(options.rootDir).catch(
    () => options.rootDir
  );
  options.srcDir = resolve(options.srcDir || options.rootDir);
  for (const key of ["srcDir", "publicDir", "buildDir"]) {
    options[key] = resolve(options.rootDir, options[key]);
  }

  // Add aliases
  options.alias = {
    ...options.alias,
    "~/": join(options.srcDir, "/"),
    "@/": join(options.srcDir, "/"),
    "~~/": join(options.rootDir, "/"),
    "@@/": join(options.rootDir, "/"),
  };

  // Resolve possibly template paths
  if (!options.static && !options.entry) {
    throw new Error(
      `Nitro entry is missing! Is "${options.preset}" preset correct?`
    );
  }
  if (options.entry) {
    options.entry = resolvePath(options.entry, options);
  }
  options.output.dir = resolvePath(
    options.output.dir || NitroDefaults.output.dir,
    options,
    options.rootDir
  );
  options.output.publicDir = resolvePath(
    options.output.publicDir || NitroDefaults.output.publicDir,
    options,
    options.rootDir
  );
  options.output.serverDir = resolvePath(
    options.output.serverDir || NitroDefaults.output.serverDir,
    options,
    options.rootDir
  );

  options.nodeModulesDirs.push(resolve(options.workspaceDir, "node_modules"));
  options.nodeModulesDirs.push(resolve(options.rootDir, "node_modules"));
  options.nodeModulesDirs.push(resolve(pkgDir, "node_modules"));
  options.nodeModulesDirs.push(resolve(pkgDir, "..")); // pnpm
  options.nodeModulesDirs = [
    ...new Set(
      options.nodeModulesDirs.map((dir) => resolve(options.rootDir, dir))
    ),
  ];

  // Resolve scanDirs
  options.scanDirs.unshift(options.srcDir);
  options.scanDirs = options.scanDirs.map((dir) =>
    resolve(options.srcDir, dir)
  );
  options.scanDirs = [...new Set(options.scanDirs)];

  if (
    options.imports &&
    Array.isArray(options.imports.exclude) &&
    options.imports.exclude.length === 0
  ) {
    // Exclude .git and buildDir by default
    options.imports.exclude.push(/[/\\]\.git[/\\]/);
    options.imports.exclude.push(options.buildDir);

    // Exclude all node modules that are not a scanDir
    const scanDirsInNodeModules = options.scanDirs
      .map((dir) => dir.match(/(?<=\/)node_modules\/(.+)$/)?.[1])
      .filter(Boolean);
    options.imports.exclude.push(
      scanDirsInNodeModules.length > 0
        ? new RegExp(
            `node_modules\\/(?!${scanDirsInNodeModules
              .map((dir) => escapeRE(dir))
              .join("|")})`
          )
        : /[/\\]node_modules[/\\]/
    );
  }

  // Add h3 auto imports preset
  if (options.imports) {
    const h3Exports = await resolveModuleExportNames("h3", {
      url: import.meta.url,
    });
    options.imports.presets.push({
      from: "h3",
      imports: h3Exports.filter((n) => !/^[A-Z]/.test(n) && n !== "use"),
    });
  }

  // Auto imports from utils dirs
  if (options.imports) {
    options.imports.dirs.push(
      ...options.scanDirs.map((dir) => join(dir, "utils/*"))
    );
  }

  // Normalize app.config file paths
  options.appConfigFiles = options.appConfigFiles
    .map((file) => resolveFile(resolvePath(file, options)))
    .filter(Boolean);

  // Detect app.config from scanDirs
  for (const dir of options.scanDirs) {
    const configFile = resolveFile("app.config", dir);
    if (configFile && !options.appConfigFiles.includes(configFile)) {
      options.appConfigFiles.push(configFile);
    }
  }

  // Backward compatibility for options.routes
  options.routeRules = defu(options.routeRules, (options as any).routes || {});

  // Normalize route rules
  options.routeRules = normalizeRouteRules(options);

  options.baseURL = withLeadingSlash(withTrailingSlash(options.baseURL));

  // Normalize runtime config
  options.runtimeConfig = normalizeRuntimeConfig(options);

  for (const publicAsset of options.publicAssets) {
    publicAsset.dir = resolve(options.srcDir, publicAsset.dir);
    publicAsset.baseURL = withLeadingSlash(
      withoutTrailingSlash(publicAsset.baseURL || "/")
    );
  }

  for (const serverAsset of options.serverAssets) {
    serverAsset.dir = resolve(options.srcDir, serverAsset.dir);
  }

  // Build-only storage
  const fsMounts = {
    root: resolve(options.rootDir),
    src: resolve(options.srcDir),
    build: resolve(options.buildDir),
    cache: resolve(options.buildDir, "cache"),
  };
  for (const p in fsMounts) {
    options.devStorage[p] = options.devStorage[p] || {
      driver: "fs",
      readOnly: p === "root" || p === "src",
      base: fsMounts[p],
    };
  }

  // Runtime storage
  if (
    options.dev &&
    options.storage.data === undefined &&
    options.devStorage.data === undefined
  ) {
    options.devStorage.data = {
      driver: "fs",
      base: resolve(options.rootDir, ".data/kv"),
    };
  } else if (options.node && options.storage.data === undefined) {
    options.storage.data = {
      driver: "fsLite",
      base: "./.data/kv",
    };
  }

  // Resolve plugin paths
  options.plugins = options.plugins.map((p) => resolvePath(p, options));

  // Export conditions
  options.exportConditions = _resolveExportConditions(
    options.exportConditions,
    { dev: options.dev, node: options.node }
  );

  // Add open-api endpoint
  if (options.dev && options.experimental.openAPI) {
    options.handlers.push({
      route: "/_nitro/openapi.json",
      handler: "#internal/nitro/routes/openapi",
    });
    options.handlers.push({
      route: "/_nitro/swagger",
      handler: "#internal/nitro/routes/swagger",
    });
  }

  // Native fetch
  if (options.experimental.nodeFetchCompat === undefined) {
    options.experimental.nodeFetchCompat = nodeMajorVersion < 18;
    if (options.experimental.nodeFetchCompat && provider !== "stackblitz") {
      consola.warn(
        "Node fetch compatibility is enabled. Please consider upgrading to Node.js >= 18."
      );
    }
  }
  if (!options.experimental.nodeFetchCompat) {
    options.alias = {
      "node-fetch-native/polyfill": "unenv/runtime/mock/empty",
      "node-fetch-native": "node-fetch-native/native",
      ...options.alias,
    };
  }

  return options;
}

/**
 * @deprecated Please import `defineNitroConfig` from nitropack/config instead
 */
export function defineNitroConfig(config: NitroConfig): NitroConfig {
  return config;
}

export function normalizeRuntimeConfig(config: NitroConfig) {
  provideFallbackValues(config.runtimeConfig);
  const runtimeConfig = defu(config.runtimeConfig, {
    app: {
      baseURL: config.baseURL,
    },
    nitro: {},
  });
  runtimeConfig.nitro.routeRules = config.routeRules;
  return runtimeConfig as NitroRuntimeConfig;
}

export function normalizeRouteRules(
  config: NitroConfig
): Record<string, NitroRouteRules> {
  const normalizedRules: Record<string, NitroRouteRules> = {};
  for (const path in config.routeRules) {
    const routeConfig = config.routeRules[path] as NitroRouteConfig;
    const routeRules: NitroRouteRules = {
      ...routeConfig,
      redirect: undefined,
      proxy: undefined,
    };
    // Redirect
    if (routeConfig.redirect) {
      routeRules.redirect = {
        to: "/",
        statusCode: 307,
        ...(typeof routeConfig.redirect === "string"
          ? { to: routeConfig.redirect }
          : routeConfig.redirect),
      };
    }
    // Proxy
    if (routeConfig.proxy) {
      routeRules.proxy =
        typeof routeConfig.proxy === "string"
          ? { to: routeConfig.proxy }
          : routeConfig.proxy;
      if (path.endsWith("/**")) {
        // Internal flag
        (routeRules.proxy as any)._proxyStripBase = path.slice(0, -3);
      }
    }
    // CORS
    if (routeConfig.cors) {
      routeRules.headers = {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "*",
        "access-control-allow-headers": "*",
        "access-control-max-age": "0",
        ...routeRules.headers,
      };
    }
    // Cache: swr
    if (routeConfig.swr) {
      routeRules.cache = routeRules.cache || {};
      routeRules.cache.swr = true;
      if (typeof routeConfig.swr === "number") {
        routeRules.cache.maxAge = routeConfig.swr;
      }
    }
    // Cache: false
    if (routeConfig.cache === false) {
      routeRules.cache = false;
    }
    normalizedRules[path] = routeRules;
  }
  return normalizedRules;
}

function _resolveExportConditions(
  conditions: string[] = [],
  opts: { dev: boolean; node: boolean }
) {
  const resolvedConditions: string[] = [];

  // 1. Add dev or production
  resolvedConditions.push(opts.dev ? "development" : "production");

  // 2. Add user specified conditions
  resolvedConditions.push(...conditions);

  // 3. Add runtime conditions (node or web)
  if (opts.node) {
    resolvedConditions.push("node");
  } else {
    // https://runtime-keys.proposal.wintercg.org/
    resolvedConditions.push(
      "wintercg",
      "worker",
      "web",
      "browser",
      "workerd",
      "edge-light",
      "lagon",
      "netlify",
      "edge-routine",
      "deno"
    );
  }

  // 4. Add default conditions
  resolvedConditions.push("import", "default");

  // Dedup with preserving order
  return resolvedConditions.filter(
    (c, i) => resolvedConditions.indexOf(c) === i
  );
}
