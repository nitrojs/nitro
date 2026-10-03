import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterAll, describe, expect, it, vi } from "vitest";
import type { Nitro, NitroOptions } from "nitro/types";

import { writeHeaders, writeRedirects } from "../../src/presets/netlify/utils.ts";
import { writeCFHeaders, writeCFPagesRedirects } from "../../src/presets/cloudflare/utils.ts";
import { writeEdgeOneConfig } from "../../src/presets/edgeone/utils.ts";

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function createNitro(options: Partial<NitroOptions>) {
  const dir = await mkdtemp(join(tmpdir(), "nitro-preset-route-config-"));
  dirs.push(dir);
  await mkdir(join(dir, "public"));
  const nitro = {
    _prerenderedRoutes: [],
    scannedHandlers: [],
    routing: { sync: () => {}, routes: { routes: [] } },
    logger: { info: vi.fn(), warn: vi.fn() },
    options: {
      baseURL: "/",
      static: false,
      handlers: [],
      routeRules: {},
      output: { dir, publicDir: join(dir, "public"), serverDir: join(dir, "server") },
      ...options,
    },
  } as unknown as Nitro;
  return { dir, nitro };
}

// `_redirects` rules are matched in order, first match wins
const redirectSources = (contents: string) =>
  contents
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split(/\s+/)[0]);

describe("netlify _redirects and _headers", () => {
  it("lists more specific redirects first", async () => {
    const { dir, nitro } = await createNitro({
      routeRules: {
        "/a/b": { redirect: { to: "/b", status: 302 } },
        "/a/:id": { redirect: { to: "/id", status: 302 } },
        "/a/**": { redirect: { to: "/all", status: 302 } },
      },
    });
    await writeRedirects(nitro);
    const redirects = await readFile(join(dir, "public/_redirects"), "utf8");
    expect(redirectSources(redirects)).toEqual(["/a/b", "/a/:id", "/a/*"]);
  });

  it("converts named catch-all params to a splat", async () => {
    const { dir, nitro } = await createNitro({
      routeRules: {
        "/old/**:path": { redirect: { to: "/new/**", status: 302 } },
        "/hdr/**:path": { headers: { "x-hdr": "1" } },
      },
    });
    await writeRedirects(nitro);
    await writeHeaders(nitro);
    expect(await readFile(join(dir, "public/_redirects"), "utf8")).toBe(
      "/old/*\t/new/:splat\t302\n"
    );
    expect(await readFile(join(dir, "public/_headers"), "utf8")).toBe("/hdr/*\n  x-hdr: 1\n");
  });

  it("prefixes sources with the baseURL and writes to the publish root", async () => {
    const { dir, nitro } = await createNitro({
      baseURL: "/base/",
      static: true,
      routeRules: {
        "/old/**": { redirect: { to: "/new/**", status: 301 } },
        "/hdr/**": { headers: { "x-hdr": "1" } },
      },
    });
    // Netlify presets output public assets to `dist/{{ baseURL }}`
    nitro.options.output.publicDir = join(dir, "public/base");
    await mkdir(nitro.options.output.publicDir);
    await writeFile(join(nitro.options.output.publicDir, "404.html"), "");
    await writeRedirects(nitro);
    await writeHeaders(nitro);
    expect(await readFile(join(dir, "public/_redirects"), "utf8")).toBe(
      "/base/old/*\t/new/:splat\t301\n/base/* /base/404.html 404"
    );
    expect(await readFile(join(dir, "public/_headers"), "utf8")).toBe("/base/hdr/*\n  x-hdr: 1\n");
  });
});

describe("cloudflare pages _redirects and _headers", () => {
  it("lists more specific redirects first", async () => {
    const { dir, nitro } = await createNitro({
      routeRules: {
        "/a/b": { redirect: { to: "/b", status: 302 } },
        "/a/:id": { redirect: { to: "/id", status: 302 } },
        "/a/**": { redirect: { to: "/all", status: 302 } },
      },
    });
    await writeCFPagesRedirects(nitro);
    const redirects = await readFile(join(dir, "_redirects"), "utf8");
    expect(redirectSources(redirects)).toEqual(["/a/b", "/a/:id", "/a/*"]);
  });

  it("interpolates the splat into redirect targets", async () => {
    const { dir, nitro } = await createNitro({
      baseURL: "/base/",
      routeRules: {
        "/old/**:path": { redirect: { to: "/new/**", status: 301 } },
        "/ext/**": { redirect: { to: "https://nitro.build/**", status: 302 } },
        "/hdr/**:path": { headers: { "x-hdr": "1" } },
      },
    });
    await writeCFPagesRedirects(nitro);
    await writeCFHeaders(nitro, "output");
    expect(await readFile(join(dir, "_redirects"), "utf8")).toBe(
      "/base/ext/*\thttps://nitro.build/:splat\t302\n/base/old/*\t/base/new/:splat\t301\n"
    );
    expect(await readFile(join(dir, "_headers"), "utf8")).toBe("/base/hdr/*\n  x-hdr: 1");
  });
});

describe("edgeone config.json", () => {
  type Route = {
    src?: string;
    status?: number;
    headers?: Record<string, string>;
    continue?: boolean;
  };

  async function buildRoutes(options: Partial<NitroOptions>): Promise<Route[]> {
    const { dir, nitro } = await createNitro(options);
    await writeEdgeOneConfig(nitro);
    return JSON.parse(await readFile(join(dir, "server/config.json"), "utf8")).routes;
  }

  // EdgeOne stops at the first matching route that does not `continue`
  const firstMatch = (routes: Route[], path: string) =>
    routes.find((r) => r.src && !r.continue && new RegExp(r.src).test(path));
  const headersFor = (routes: Route[], path: string) =>
    routes
      .filter((r) => r.src && r.headers && new RegExp(r.src).test(path))
      .reduce((headers, r) => ({ ...headers, ...r.headers }), {});

  it("matches route rules like the runtime does", async () => {
    const routes = await buildRoutes({
      baseURL: "/base/",
      routeRules: {
        "/file.json": { headers: { "x-file": "1" } },
        "/docs/**": { headers: { "x-docs": "1" } },
        "/single/*": { headers: { "x-single": "1" } },
      },
    });
    expect(headersFor(routes, "/base/file.json")).toEqual({ "x-file": "1" });
    expect(headersFor(routes, "/base/fileXjson")).toEqual({});
    expect(headersFor(routes, "/base/docs")).toEqual({ "x-docs": "1" });
    expect(headersFor(routes, "/base/docs/a/b")).toEqual({ "x-docs": "1" });
    expect(headersFor(routes, "/base/single/a/b")).toEqual({ "x-single": "1" });
  });

  it("matches the most specific redirect first", async () => {
    const routes = await buildRoutes({
      routeRules: {
        "/r/**": { redirect: { to: "/all/**", status: 302 } },
        "/r/special": { redirect: { to: "/special", status: 301 } },
        "/ext/**": { redirect: { to: "https://nitro.build/**", status: 302 } },
      },
    });
    expect(firstMatch(routes, "/r/special")?.headers?.Location).toBe("/special");
    const catchAll = firstMatch(routes, "/r/a/b")!;
    expect("/r/a/b".replace(new RegExp(catchAll.src!), catchAll.headers!.Location)).toBe(
      "/all/a/b"
    );
    const external = firstMatch(routes, "/ext/a")!;
    expect("/ext/a".replace(new RegExp(external.src!), external.headers!.Location)).toBe(
      "https://nitro.build/a"
    );
  });
});
