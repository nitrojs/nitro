import { defineConfig } from "nitro";

import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";
import MagicString from "magic-string";

export default defineConfig({
  vercel: {
    immutableStaticFiles: true,
    functionRules: {
      "/api/hello": {
        maxDuration: 100,
      },
      "/api/echo": {
        experimentalTriggers: [{ type: "queue/v2beta", topic: "orders" }],
      },
      "/rules/isr/**": {
        regions: ["lhr1", "cdg1"],
      },
    },
  },
  compressPublicAssets: true,
  compatibilityDate: "latest",
  serverDir: "server",
  builder: (process.env.NITRO_BUILDER as any) || "rolldown",
  // @ts-expect-error
  __vitePkg__: process.env.NITRO_VITE_PKG,
  framework: { name: "nitro", version: "3.x" },
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
  buildPlugins: [
    {
      name: "fixture:virtual",
      resolveId: {
        filter: { id: /^virtual:build-plugin$/ },
        handler: (id) => `\0${id}`,
      },
      load: {
        filter: { id: /^\0virtual:build-plugin$/ },
        handler: () => `export default "Hello from build plugin!"`,
      },
    },
    [
      {
        name: "fixture:transform",
        enforce: "pre",
        transform: {
          filter: { id: /build-plugins\.ts$/ },
          handler: (code) => code.replace("__BUILD_PLUGIN_TRANSFORM__", "transformed"),
        },
      },
    ],
    {
      name: "fixture:sourcemap",
      transform: {
        filter: { id: /errors[/\\]stack\.ts$/ },
        handler(code) {
          const s = new MagicString(code).prepend("// fixture:sourcemap\n".repeat(5));
          return { code: s.toString(), map: s.generateMap({ hires: true }) };
        },
      },
      renderChunk(code: string, _chunk: unknown, outputOpts: { sourcemap?: unknown }) {
        // Only on the unminified line (a minified one may start inside a template literal)
        const line = /\n[ \t]*stack: new Error\(["']testing error/.exec(code);
        if (!outputOpts.sourcemap || !line) {
          return;
        }
        const s = new MagicString(code).appendLeft(line.index + 1, "\n".repeat(5));
        return { code: s.toString(), map: s.generateMap({ hires: true }) };
      },
    },
  ],
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
      route: "/api/middleware-order",
      handler: "./server/routed-middleware/order.ts",
      middleware: true,
    },
    {
      route: "/rules/swr/middleware-order",
      handler: "./server/routed-middleware/order.ts",
      middleware: true,
    },
    {
      route: "/api/methods/guarded",
      handler: "./server/routed-middleware/guard.ts",
      method: "GET",
      middleware: true,
    },
    {
      route: "/virtual",
      handler: "#virtual-route",
    },
    {
      route: "/traced-root-export",
      handler: "./node_modules/@fixture/nitro-root-export/index.mjs",
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
    "/rules/redirect/wildcard-query/**": {
      redirect: { to: "/target?param=**", status: 301 },
    },
    "/rules/redirect/legacy/**": { redirect: "/**" },
    "/rules/nested/**": { redirect: "/base", headers: { "x-test": "test" } },
    "/rules/nested/override": { redirect: { to: "/other" } },
    "/rules/_/noncached/cached": { swr: true, isr: true },
    "/rules/_/noncached/**": { swr: false, cache: false, isr: false },
    "/rules/_/cached/noncached": { cache: false, swr: false, isr: false },
    "/rules/_/cached/**": { swr: true, isr: true },
    "/api/proxy/**": { proxy: "/api/echo" },
    "/rules/proxy/legacy/**": { proxy: "/api/wildcard/**" },
    "/cdn/**": { proxy: "https://cdn.jsdelivr.net/**" },
    // Method-scoped route rules: the `"METHOD /path"` key only applies to that method.
    "POST /rules/method-scoped/**": { cors: true },
    "GET /rules/method-scoped/redirect": { redirect: "/base" },
    "/single-headers/*": { headers: { "x-single": "single" } },
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
  openAPI: {
    production: "prerender",
    meta: {
      title: "Nitro Test Fixture",
      description: "Nitro Test Fixture API",
      version: "2.0",
    },
  },
});
