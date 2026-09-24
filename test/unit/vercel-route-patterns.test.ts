import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { describe, expect, it } from "vitest";
import type { Nitro, NitroOptions } from "nitro/types";
import { Router } from "../../src/routing.ts";
import { generateFunctionFiles } from "../../src/presets/vercel/utils.ts";
import type { VercelBuildConfigV3 } from "../../src/presets/vercel/types.ts";

const vercelRoutePatterns = [
  {
    pattern: "/icon.png",
    matches: ["/icon.png", "/icon.png/"],
    misses: ["/iconXpng", "/prefix/icon.png", "/icon.png/extra"],
  },
  {
    pattern: "/users/:user-id",
    matches: ["/users/alice", "/users/alice/"],
    misses: ["/users", "/users/alice/profile"],
  },
  {
    pattern: "/posts/:id(\\d+)",
    matches: ["/posts/123", "/posts/123/"],
    misses: ["/posts/abc", "/posts/123abc"],
  },
  {
    pattern: "/pages/:slug?",
    matches: ["/pages", "/pages/", "/pages/about"],
    misses: ["/pages/about/team", "/pages-other"],
  },
  {
    pattern: "/articles/:id(\\d+){-:title}?",
    matches: ["/articles/123", "/articles/123-title"],
    misses: ["/articles/title", "/articles/123/title"],
  },
  {
    pattern: "/files/*.json",
    matches: ["/files/config.json"],
    misses: ["/files/configXjson", "/files/nested/config.json"],
  },
  {
    pattern: "/single/*",
    matches: ["/single/value", "/single/value/"],
    misses: ["/single/value/nested"],
  },
  {
    pattern: "/docs/**",
    matches: ["/docs", "/docs/", "/docs/guide", "/docs/guide/start"],
    misses: ["/docs-other", "/prefix/docs/guide"],
  },
  {
    pattern: "/named/**:path",
    matches: ["/named/guide", "/named/guide/start"],
    misses: ["/named", "/named/", "/named-other"],
  },
];

describe("Vercel route patterns", () => {
  it.each(vercelRoutePatterns)("compiles $pattern for observability", async (fixture) => {
    const config = await generateConfig({ ssrRoutes: [fixture.pattern] });
    const route = config.routes.find((route) => route.dest !== "/__server")!;
    const regexp = new RegExp(route.src);
    for (const path of fixture.matches) {
      expect(regexp.test(path), path).toBe(true);
    }
    for (const path of fixture.misses) {
      expect(regexp.test(path), path).toBe(false);
    }
  });

  it("compiles header and redirect rules with literal and dynamic segments", async () => {
    const config = await generateConfig({
      routeRules: {
        "/files/:id(\\d+).json": { headers: { "x-pattern": "file" } },
        "/:org/old/**": { redirect: { to: "/new/**", status: 307 } },
      },
    });
    const header = config.routes.find((route) => route.headers?.["x-pattern"])!;
    const redirect = config.routes.find((route) => route.status === 307)!;
    const regexp = new RegExp(header.src);
    expect(regexp.test("/files/123.json")).toBe(true);
    expect(regexp.test("/files/abc.json")).toBe(false);
    expect(regexp.test("/files/123Xjson")).toBe(false);
    const match = new RegExp(redirect.src).exec("/acme/old/guide/start");
    expect(expandTarget(redirect.headers!.Location, match)).toBe("/new/guide/start");
  });

  it("substitutes named catch-alls in redirect and proxy targets", async () => {
    const config = await generateConfig({
      routeRules: {
        "/old/**:rest": { redirect: { to: "/new/**", status: 307 } },
        "/cdn/**:file-path": { proxy: { to: "https://cdn.example.com/**" } },
      },
    });
    const redirect = config.routes.find((route) => route.status === 307)!;
    const proxy = config.routes.find((route) => route.dest?.startsWith("https:"))!;
    const redirectMatch = new RegExp(redirect.src).exec("/old/guide/start");
    expect(expandTarget(redirect.headers!.Location, redirectMatch)).toBe("/new/guide/start");
    const proxyMatch = new RegExp(proxy.src).exec("/cdn/nested/file.json");
    expect(expandTarget(proxy.dest!, proxyMatch)).toBe("https://cdn.example.com/nested/file.json");
  });

  it("preserves the catch-all capture in CDN proxy rewrites", async () => {
    const config = await generateConfig({
      routeRules: {
        "/:org/cdn/**": { proxy: { to: "https://cdn.example.com/**" } },
      },
    });
    const route = config.routes.find((route) => route.dest?.startsWith("https:"))!;
    const match = new RegExp(route.src).exec("/acme/cdn/nested/file.json");
    expect(expandTarget(route.dest!, match)).toBe("https://cdn.example.com/nested/file.json");
  });

  it("captures the complete ISR path with optional parameters", async () => {
    const config = await generateConfig({ routeRules: { "/posts/:slug?": { isr: true } } });
    const route = config.routes.find((route) => route.dest?.includes("-isr?"))!;
    const regexp = new RegExp(route.src);
    for (const path of ["/posts", "/posts/", "/posts/hello", "/posts/hello/"]) {
      expect(regexp.exec(path)?.groups?.__isr_route, path).toBe(path);
    }
    expect(regexp.test("/posts/hello/extra")).toBe(false);
  });

  it("compiles function and observability routes under a literal base URL", async () => {
    const config = await generateConfig({
      baseURL: "/app.v1/",
      ssrRoutes: ["/pages/:slug?"],
      vercel: { functionRules: { "/users/:id(\\d+)": { memory: 1024 } } },
    });
    const routes = config.routes.filter((route) => route.dest !== "/__server");
    const [func, observability] = routes.map((route) => new RegExp(route.src));
    expect(func.test("/app.v1/users/123")).toBe(true);
    expect(func.test("/appXv1/users/123")).toBe(false);
    expect(func.test("/app.v1/users/abc")).toBe(false);
    expect(observability.test("/app.v1/pages")).toBe(true);
    expect(observability.test("/app.v1/pages/about")).toBe(true);
    expect(observability.test("/pages/about")).toBe(false);
  });

  it("prefixes route rules and root ISR with the base URL before compiling", async () => {
    const config = await generateConfig({
      baseURL: "/app.v1/",
      routeRules: {
        "/": { isr: true },
        "/old/**": { redirect: { to: "/new/**", status: 307 } },
        "/cdn/**": { proxy: { to: "https://cdn.example.com/**" } },
        "/private/**": { isr: false },
      },
    });
    const root = config.routes.find((route) => route.dest?.startsWith("/index-isr?"))!;
    expect(new RegExp(root.src).exec("/app.v1/")?.groups?.__isr_route).toBe("/app.v1/");
    expect(new RegExp(root.src).test("/")).toBe(false);
    for (const path of ["/old/page", "/cdn/file.json", "/private/page"]) {
      const routes = config.routes.filter((route) => route.src !== "/(.*)");
      expect(routes.some((route) => new RegExp(route.src).test(`/app.v1${path}`))).toBe(true);
      expect(routes.some((route) => new RegExp(route.src).test(path))).toBe(false);
    }
  });
});

async function generateConfig(options: Partial<NitroOptions>) {
  const dir = await mkdtemp(join(tmpdir(), "nitro-vercel-patterns-"));
  const serverDir = join(dir, "functions/__server.func");
  await mkdir(serverDir, { recursive: true });
  const nitro = {
    options: {
      baseURL: "/",
      compatibilityDate: { default: "2025-07-15" },
      framework: { name: "nitro", version: "3.x" },
      routeRules: {},
      publicAssets: [],
      handlers: [],
      experimental: {},
      ...options,
      output: { dir, serverDir },
    },
    scannedHandlers: [],
    routing: { routeRules: new Router() },
  } as unknown as Nitro;
  try {
    await generateFunctionFiles(nitro);
    const config = JSON.parse(
      await readFile(join(dir, "config.json"), "utf8")
    ) as VercelBuildConfigV3;
    return { ...config, routes: config.routes!.filter((route) => "src" in route) };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function expandTarget(target: string, match: RegExpExecArray | null) {
  expect(match).not.toBeNull();
  return target.replace(/\$(\w+)/g, (_, key) => match?.groups?.[key] ?? match?.[Number(key)] ?? "");
}
