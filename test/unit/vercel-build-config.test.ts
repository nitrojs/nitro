import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Nitro, NitroOptions } from "nitro/types";

import { generateEdgeFunctionFiles } from "../../src/presets/vercel/utils.ts";

type Route = {
  src?: string;
  dest?: string;
  headers?: Record<string, string>;
  status?: number;
  continue?: boolean;
};

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function buildRoutes(options: Partial<NitroOptions>): Promise<Route[]> {
  const dir = await mkdtemp(join(tmpdir(), "nitro-vercel-build-config-"));
  dirs.push(dir);
  const nitro = {
    _prerenderedRoutes: [],
    options: {
      baseURL: "/",
      static: false,
      framework: { name: "nitro", version: "3.x" },
      experimental: {},
      publicAssets: [],
      output: { dir, serverDir: join(dir, "functions/__server.func") },
      routeRules: {},
      vercel: {},
      ...options,
    },
  } as unknown as Nitro;
  await generateEdgeFunctionFiles(nitro);
  return JSON.parse(await readFile(join(dir, "config.json"), "utf8")).routes;
}

// Vercel stops at the first matching route that does not `continue`
const firstMatch = (routes: Route[], path: string) =>
  routes.find((r) => r.src && !r.continue && new RegExp(r.src).test(path));

describe("vercel config with a baseURL", () => {
  let routes: Route[];

  beforeAll(async () => {
    routes = await buildRoutes({
      baseURL: "/base/",
      routeRules: {
        "/hdr/**": { headers: { "x-hdr": "1" } },
        "/old/**": { redirect: { to: "/new/**", status: 307 } },
        "/cdn/**": { proxy: { to: "https://example.com/**" } },
        "/isr/**": { isr: true },
      },
      vercel: {
        functionRules: {
          "/fn/**": { maxDuration: 10 },
          "/fn/special": { maxDuration: 20 },
        },
      },
    } as Partial<NitroOptions>);
  });

  // Route rule keys are relative to the baseURL, as at runtime
  it("prefixes header rules", () => {
    const route = routes.find((r) => r.src && new RegExp(r.src).test("/base/hdr/a"));
    expect(route?.headers).toEqual({ "x-hdr": "1" });
  });

  it("prefixes redirect rules but not their target", () => {
    expect(firstMatch(routes, "/base/old/a/b")).toMatchObject({
      status: 307,
      headers: { Location: "/new/$1" },
    });
  });

  it("prefixes proxy rules", () => {
    expect(firstMatch(routes, "/base/cdn/a")?.dest).toBe("https://example.com/$1");
  });

  it("prefixes ISR rules", () => {
    expect(firstMatch(routes, "/base/isr/a")?.dest).toBe("/isr/[...]-isr?__isr_route=$__isr_route");
  });

  it("orders functionRules routes from the most specific", () => {
    expect(firstMatch(routes, "/base/fn/special")?.dest).toBe("/fn/special");
    expect(firstMatch(routes, "/base/fn/other")?.dest).toBe("/fn/[...]");
  });
});

// Vercel re-encodes a capture substituted into a query string (`a&b=c` adds a
// param, `a+b` becomes `a b`), unlike h3, so these rules stay in the function.
describe("vercel config with `**` in the query of a target", () => {
  let routes: Route[];

  beforeAll(async () => {
    routes = await buildRoutes({
      routeRules: {
        "/r/**": { redirect: { to: "/landing", status: 307 } },
        "/r/query/**": { redirect: { to: "/q?path=**", status: 301 } },
        "/r/hash/**": { redirect: { to: "/h#**", status: 301 } },
        "/r/path/**": { redirect: { to: "/p/**?keep=1", status: 301 } },
        "/r/proxy/**": { proxy: { to: "https://example.com/search?q=**" } },
      },
    } as Partial<NitroOptions>);
  });

  it("leaves query redirects to the server function", () => {
    const route = firstMatch(routes, "/r/query/a&b=c");
    expect(route?.src).toBeDefined();
    expect(route?.status).toBeUndefined();
    expect(route?.headers).toBeUndefined();
  });

  it("leaves fragment redirects to the server function", () => {
    expect(firstMatch(routes, "/r/hash/a")?.status).toBeUndefined();
  });

  it("leaves query proxies to the server function", () => {
    const route = firstMatch(routes, "/r/proxy/a");
    expect(route?.src).toBeDefined();
    expect(route?.dest).toBeUndefined();
    expect(route?.status).toBeUndefined();
    expect(routes.some((r) => r.dest?.startsWith("https://example.com"))).toBe(false);
  });

  it("keeps redirects with `**` in the path at the CDN", () => {
    expect(firstMatch(routes, "/r/path/a")).toMatchObject({
      status: 301,
      headers: { Location: "/p/$1?keep=1" },
    });
  });

  it("keeps less specific redirects at the CDN", () => {
    expect(firstMatch(routes, "/r/other")).toMatchObject({
      status: 307,
      headers: { Location: "/landing" },
    });
  });
});

describe("vercel config with `redirect: false`", () => {
  let routes: Route[];

  beforeAll(async () => {
    routes = await buildRoutes({
      routeRules: {
        "/foo/**": { redirect: { to: "/x", status: 307 } },
        "/foo/keep": { redirect: false },
        "/foo/keep-all/**": { redirect: false },
        "/account": { redirect: false },
      },
    } as Partial<NitroOptions>);
  });

  it("keeps the opted out path from the broader redirect", () => {
    // `/foo/keep` has to stop routing (be handled by the server) before the
    // `/foo/**` redirect can match it (#4655)
    const keep = firstMatch(routes, "/foo/keep");
    expect(keep).toBeDefined();
    expect(keep!.headers?.Location).toBeUndefined();
  });

  it("keeps opted out wildcard paths from the broader redirect", () => {
    const keep = firstMatch(routes, "/foo/keep-all/a/b");
    expect(keep).toBeDefined();
    expect(keep!.headers?.Location).toBeUndefined();
  });

  it("still redirects the rest of the broader rule", () => {
    expect(firstMatch(routes, "/foo/other")!.headers?.Location).toBe("/x");
  });

  // A stop route would also skip skew protection and public asset headers
  it("emits no route when no redirect can match", () => {
    expect(firstMatch(routes, "/account")).toEqual({ src: "/(.*)", dest: "/__server" });
  });
});
