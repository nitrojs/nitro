import { defineConfig } from "nitro";

import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";

export default defineConfig({
  compressPublicAssets: true,
  compatibilityDate: "latest",
  serverDir: "server",
  builder: (process.env.NITRO_BUILDER as any) || "rolldown",
  // @ts-expect-error
  __vitePkg__: process.env.NITRO_VITE_PKG,
  framework: { name: "nitro", version: "3.x" },
  imports: {
    presets: [
      {
        // TODO: move this to built-in preset
        from: "scule",
        imports: ["camelCase", "pascalCase", "kebabCase"],
      },
    ],
  },
  sourcemap: true,
  rollupConfig: {
    output: {
      sourcemapPathTransform: (relativeSourcePath, sourcemapPath) => {
        const sourcemapDir = dirname(sourcemapPath);
        const sourcePath = resolve(sourcemapDir, relativeSourcePath);
        return existsSync(sourcePath) ? sourcePath : relativeSourcePath;
      },
    },
  },
  virtual: {
    "#virtual-route": () => `export default () => new Response("Hello from virtual entry!")`,
  },
  handlers: [
    {
      route: "/api/test/*/foo",
      handler: "./server/routes/api/hello.ts",
      method: "GET",
    },
    {
      route: "/api/hello2",
      handler: "./server/routes/api/hello.ts",
      middleware: true,
    },
    {
      route: "/virtual",
      handler: "#virtual-route",
    },
  ],
  devProxy: {
    "/proxy/example": {
      target: "https://icanhazip.com",
      changeOrigin: true,
      ignorePath: true,
    },
  },
  traceDeps: ["@fixture"],
  serverAssets: [
    {
      baseName: "files",
      dir: "server/files",
    },
  ],
  ignore: ["routes/api/**/_*", "middleware/_ignored.ts", "routes/_*.ts", "**/_*.txt"],
  runtimeConfig: {
    dynamic: "initial",
    url: "https://{{APP_DOMAIN}}",
  },
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
  errorHandler: "error.ts",
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
      redirect: { to: "https://nitro.build/", status: 308 },
    },
    "/rules/redirect/wildcard/**": { redirect: "https://nitro.build/**" },
    "/rules/nested/**": { redirect: "/base", headers: { "x-test": "test" } },
    "/rules/nested/override": { redirect: { to: "/other" } },
    "/rules/_/noncached/cached": { swr: true },
    "/rules/_/noncached/**": { swr: false, cache: false, isr: false },
    "/rules/_/cached/noncached": { cache: false, swr: false, isr: false },
    "/rules/_/cached/**": { swr: true },
    "/api/proxy/**": { proxy: "/api/echo" },
    "/cdn/**": { proxy: "https://cdn.jsdelivr.net/**" },
    "/rules/auth/**": { auth: { password: "testpass" } },
    "/rules/auth-user/**": { auth: { username: "admin", password: "secret" } },
    "/rules/no-auth/**": { auth: false },
    "**": { headers: { "x-test": "test" } },
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
  typescript: {
    generateRuntimeConfigTypes: true,
    generateTsConfig: true,
  },
  openAPI: {
    production: "prerender",
    meta: {
      title: "Nitro Test Fixture",
      description: "Nitro Test Fixture API",
      version: "2.0",
    },
  },
});
