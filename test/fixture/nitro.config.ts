import { fileURLToPath } from "node:url";
import { defineNitroConfig } from "nitropack/config";

export default defineNitroConfig({
  compressPublicAssets: true,
  compatibilityDate: "2024-09-19",
  framework: {
    name: "nitro",
    version: "2.x",
  },
  imports: {
    presets: [
      {
        // TODO: move this to built-in preset
        from: "scule",
        imports: ["camelCase", "pascalCase", "kebabCase"],
      },
    ],
  },
  handlers: [
    {
      route: "/api/test/*/foo",
      handler: "~/api/hello.ts",
      // @ts-expect-error #2382
      method: "GET",
    },
  ],
  devProxy: {
    "/proxy/example": { target: "https://example.com", changeOrigin: true },
  },
  alias: {
    "#fixture-nitro-utils-extra-absolute": fileURLToPath(
      new URL("node_modules/@fixture/nitro-utils/extra2.mjs", import.meta.url)
    ),
  },
  serverAssets: [
    {
      baseName: "files",
      dir: "files",
    },
  ],
  ignore: [
    "api/**/_*",
    "middleware/_ignored.ts",
    "routes/_*.ts",
    "**/_*.txt",
    "!**/_unignored.txt",
  ],
  appConfig: {
    "nitro-config": true,
    dynamic: "initial",
  },
  runtimeConfig: {
    dynamic: "initial",
    url: "https://{{APP_DOMAIN}}",
  },
  appConfigFiles: ["~/server.config.ts"],
  publicAssets: [
    {
      baseURL: "build",
      dir: "public/build",
      maxAge: 3600,
    },
  ],
  tasks: {
    "db:migrate": { description: "Migrate database" },
    "db:seed": { description: "Seed database" },
  },
  routeRules: {
    "/api/param/prerender4": { prerender: true },
    "/api/param/prerender2": { prerender: false },
    "/rules/headers": { headers: { "cache-control": "s-maxage=60" } },
    "/rules/cors": {
      cors: true,
      headers: { "access-control-allow-methods": "GET" },
    },
    "/rules/dynamic": { cache: false, isr: false },
    "/rules/redirect": { redirect: "/base" },
    "/rules/isr/**": { isr: { allowQuery: ["q"] } },
    "/rules/isr-ttl/**": { isr: 60 },
    "/rules/swr/**": { swr: true },
    "/rules/swr-ttl/**": { swr: 60 },
    "/rules/redirect/obj": {
      redirect: { to: "https://nitro.build/", statusCode: 308 },
    },
    "/rules/redirect/wildcard/**": { redirect: "https://nitro.build/**" },
    "/rules/nested/**": { redirect: "/base", headers: { "x-test": "test" } },
    "/rules/nested/override": { redirect: { to: "/other" } },
    "/rules/_/noncached/cached": { swr: true },
    "/rules/_/noncached/**": { swr: false, cache: false, isr: false },
    "/rules/_/cached/noncached": { cache: false, swr: false, isr: false },
    "/rules/_/cached/**": { swr: true },
    "/api/proxy/**": { proxy: "/api/echo" },
    "/stream-cached": { swr: true },
  },
  prerender: {
    crawlLinks: true,
    ignore: [
      // '/api/param/'
    ],
    routes: ["/prerender", "/prerender-custom.html", "/404"],
  },
  experimental: {
    openAPI: true,
    asyncContext: true,
    wasm: true,
    envExpansion: true,
    database: true,
    tasks: true,
  },
  scheduledTasks: {
    "* * * * *": "test",
  },
  cloudflare: {
    pages: {
      routes: {
        include: ["/*"],
        exclude: ["/blog/static/*", "/cf-pages-exclude/*"],
      },
    },
    wrangler: {
      compatibility_date: "2024-01-01",
    },
  },
  openAPI: {
    production: "prerender",
    meta: {
      title: "Nitro Test Fixture",
      description: "Nitro Test Fixture API",
      version: "2.0",
    },
    ui: {
      scalar: {
        theme: "purple",
      },
    },
  },
});
