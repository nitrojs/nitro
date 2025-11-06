import { runtimeDir } from "nitro/runtime/meta";
import type { NitroConfig } from "nitro/types";
import { resolve } from "pathe";
import { isDebug, isTest } from "std-env";

export const NitroDefaults: NitroConfig = {
  // General
  compatibilityDate: "latest",
  debug: isDebug,
  logLevel: isTest ? 1 : 3,
  runtimeConfig: { app: {}, nitro: {} },

  // Dirs
  serverDir: false,
  scanDirs: [],
  buildDir: `node_modules/.nitro`,
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
  publicAssets: [],
  serverAssets: [],
  plugins: [],
  tasks: {},
  scheduledTasks: {},
  imports: false,
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
  routes: {},
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
  builder: undefined,
  moduleSideEffects: ["unenv/polyfill/", resolve(runtimeDir, "polyfill/")],
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
    strict: true,
    generateRuntimeConfigTypes: false,
    generateTsConfig: false,
    tsconfigPath: "tsconfig.json",
    internalPaths: false,
    tsConfig: undefined,
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
