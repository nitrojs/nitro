import { runtimeDir } from "nitropack/runtime/meta";
import type { NitroConfig } from "nitropack/types";
import { resolve } from "pathe";
import { isDebug, isTest } from "std-env";

export const NitroDefaults: NitroConfig = {
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
  scheduledTasks: {},
  imports: {
    exclude: [],
    dirs: [],
    presets: [],
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
  errorHandler: undefined,
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
  unenv: {},
  analyze: false,
  moduleSideEffects: [
    "unenv/polyfill/",
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
    generateRuntimeConfigTypes: true,
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
    version: "",
  },
};
