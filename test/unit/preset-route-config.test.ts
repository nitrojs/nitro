import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterAll, describe, expect, it, vi } from "vitest";
import type { Nitro, NitroOptions } from "nitro/types";

import { writeHeaders, writeRedirects } from "../../src/presets/netlify/utils.ts";
import { writeCFHeaders, writeCFPagesRedirects } from "../../src/presets/cloudflare/utils.ts";
import { writeEdgeOneConfig } from "../../src/presets/edgeone/utils.ts";
import { sortRoutes } from "../../src/presets/_utils/routes.ts";

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

    // Rebuilding does not merge the previous output again
    await writeRedirects(nitro);
    await writeHeaders(nitro);
    expect(await readFile(join(dir, "public/_redirects"), "utf8")).toBe(
      "/base/old/*\t/new/:splat\t301\n/base/* /base/404.html 404"
    );
    expect(await readFile(join(dir, "public/_headers"), "utf8")).toBe("/base/hdr/*\n  x-hdr: 1\n");
  });

  it("moves user files from the baseURL dir to the publish root", async () => {
    const { dir, nitro } = await createNitro({
      baseURL: "/base/",
      routeRules: {
        "/old/**": { redirect: { to: "/new/**", status: 301 } },
        "/hdr/**": { headers: { "x-hdr": "1" } },
      },
    });
    nitro.options.output.publicDir = join(dir, "public/base");
    await mkdir(nitro.options.output.publicDir);
    await writeFile(join(nitro.options.output.publicDir, "_redirects"), "/user /other 302");
    await writeFile(join(nitro.options.output.publicDir, "_headers"), "/user\n  x-user: 1");
    await writeRedirects(nitro);
    await writeHeaders(nitro);
    expect(await readFile(join(dir, "public/_redirects"), "utf8")).toBe(
      "/user /other 302\n/base/old/*\t/new/:splat\t301\n"
    );
    expect(await readFile(join(dir, "public/_headers"), "utf8")).toBe(
      "/user\n  x-user: 1\n/base/hdr/*\n  x-hdr: 1\n"
    );
    expect(existsSync(join(dir, "public/base/_redirects"))).toBe(false);
    expect(existsSync(join(dir, "public/base/_headers"))).toBe(false);
  });

  it("keeps a user fallback under the baseURL", async () => {
    const { dir, nitro } = await createNitro({
      baseURL: "/base/",
      routeRules: { "/old/**": { redirect: { to: "/new/**", status: 301 } } },
    });
    nitro.options.output.publicDir = join(dir, "public/base");
    await mkdir(nitro.options.output.publicDir);
    await writeFile(
      join(nitro.options.output.publicDir, "_redirects"),
      "/base/* /base/index.html 200"
    );
    await writeRedirects(nitro);
    expect(await readFile(join(dir, "public/_redirects"), "utf8")).toBe(
      "/base/* /base/index.html 200"
    );
  });

  it("writes to a custom publicDir that does not end with the baseURL", async () => {
    const { dir, nitro } = await createNitro({
      baseURL: "/app/",
      routeRules: { "/old/**": { redirect: { to: "/new/**", status: 301 } } },
    });
    await writeRedirects(nitro);
    expect(await readFile(join(dir, "public/_redirects"), "utf8")).toBe(
      "/app/old/*\t/new/:splat\t301\n"
    );
    expect(existsSync(join(dir, "_redirects"))).toBe(false);
  });

  it("skips method-scoped rules with a warning", async () => {
    const { dir, nitro } = await createNitro({
      routeRules: {
        "GET /old/**": { redirect: { to: "/new/**", status: 302 } },
        "/plain/**": { redirect: { to: "/other/**", status: 302 } },
        "GET /hdr/**": { headers: { "x-get": "1" } },
        "/hdr/**": { headers: { "x-hdr": "1" } },
      },
    });
    await writeRedirects(nitro);
    await writeHeaders(nitro);
    expect(await readFile(join(dir, "public/_redirects"), "utf8")).toBe(
      "/plain/*\t/other/:splat\t302\n"
    );
    expect(await readFile(join(dir, "public/_headers"), "utf8")).toBe("/hdr/*\n  x-hdr: 1\n");
    expect(nitro.logger.warn).toHaveBeenCalledTimes(2);
    expect(nitro.logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/`GET \/old\/\*\*`.*`_redirects`/)
    );
    expect(nitro.logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/`GET \/hdr\/\*\*`.*`_headers`/)
    );
  });

  it("skips redirects that would shadow a skipped method-scoped redirect", async () => {
    const { dir, nitro } = await createNitro({
      routeRules: {
        "/old/**": { redirect: { to: "/a/**", status: 302 } },
        "GET /old/**": { redirect: { to: "/b/**", status: 302 } },
        "/old/specific": { redirect: { to: "/sp", status: 302 } },
        "/s/**": { redirect: { to: "/t/**", status: 302 } },
        "GET /s/a": { redirect: { to: "/u", status: 302 } },
        "/keep/**": { redirect: { to: "/k/**", status: 302 } },
      },
    });
    await writeRedirects(nitro);
    const redirects = await readFile(join(dir, "public/_redirects"), "utf8");
    expect(redirectSources(redirects).sort()).toEqual(["/keep/*", "/old/specific"]);
    expect(nitro.logger.warn).toHaveBeenCalledTimes(4);
    expect(nitro.logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/`\/old\/\*\*`.*`GET \/old\/\*\*`/)
    );
    expect(nitro.logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/`\/s\/\*\*`.*`GET \/s\/a`/)
    );
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
        "/cdn/**": { redirect: { to: "//cdn.nitro.build/**", status: 302 } },
        "/hdr/**:path": { headers: { "x-hdr": "1" } },
      },
    });
    await writeCFPagesRedirects(nitro);
    await writeCFHeaders(nitro, "output");
    expect(await readFile(join(dir, "_redirects"), "utf8")).toBe(
      "/base/cdn/*\t//cdn.nitro.build/:splat\t302\n/base/ext/*\thttps://nitro.build/:splat\t302\n/base/old/*\t/new/:splat\t301\n"
    );
    expect(await readFile(join(dir, "_headers"), "utf8")).toBe("/base/hdr/*\n  x-hdr: 1");
  });

  it("skips method-scoped rules with a warning", async () => {
    const { dir, nitro } = await createNitro({
      routeRules: {
        "GET /old/**": { redirect: { to: "/new/**", status: 302 } },
        "/plain/**": { redirect: { to: "/other/**", status: 302 } },
        "GET /hdr/**": { headers: { "x-get": "1" } },
        "/hdr/**": { headers: { "x-hdr": "1" } },
      },
    });
    await writeCFPagesRedirects(nitro);
    await writeCFHeaders(nitro, "output");
    expect(await readFile(join(dir, "_redirects"), "utf8")).toBe("/plain/*\t/other/:splat\t302\n");
    expect(await readFile(join(dir, "_headers"), "utf8")).toBe("/hdr/*\n  x-hdr: 1");
    expect(nitro.logger.warn).toHaveBeenCalledTimes(2);
    expect(nitro.logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/`GET \/old\/\*\*`.*`_redirects`/)
    );
    expect(nitro.logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/`GET \/hdr\/\*\*`.*`_headers`/)
    );
  });

  it("skips redirects that would shadow a skipped method-scoped redirect", async () => {
    const { dir, nitro } = await createNitro({
      routeRules: {
        "/old/**": { redirect: { to: "/a/**", status: 302 } },
        "GET /old/**": { redirect: { to: "/b/**", status: 302 } },
        "/old/specific": { redirect: { to: "/sp", status: 302 } },
        "/s/**": { redirect: { to: "/t/**", status: 302 } },
        "GET /s/a": { redirect: { to: "/u", status: 302 } },
        "/keep/**": { redirect: { to: "/k/**", status: 302 } },
      },
    });
    await writeCFPagesRedirects(nitro);
    const redirects = await readFile(join(dir, "_redirects"), "utf8");
    expect(redirectSources(redirects).sort()).toEqual(["/keep/*", "/old/specific"]);
    expect(nitro.logger.warn).toHaveBeenCalledTimes(4);
    expect(nitro.logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/`\/old\/\*\*`.*`GET \/old\/\*\*`/)
    );
    expect(nitro.logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/`\/s\/\*\*`.*`GET \/s\/a`/)
    );
  });
});

describe("edgeone config.json", () => {
  type Route = {
    src?: string;
    status?: number;
    headers?: Record<string, string>;
    methods?: string[];
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

  it("uses redirect targets as written with a baseURL", async () => {
    const routes = await buildRoutes({
      baseURL: "/base/",
      routeRules: {
        "/r/**": { redirect: { to: "/all/**", status: 302 } },
        "/r/special": { redirect: { to: "/special", status: 301 } },
        "/ext/**": { redirect: { to: "https://nitro.build/**", status: 302 } },
        "/cdn/**": { redirect: { to: "//cdn.nitro.build/**", status: 302 } },
      },
    });
    const resolve = (path: string) => {
      const route = firstMatch(routes, path)!;
      return path.replace(new RegExp(route.src!), route.headers!.Location);
    };
    expect(firstMatch(routes, "/base/r/special")?.headers?.Location).toBe("/special");
    expect(resolve("/base/r/a/b")).toBe("/all/a/b");
    expect(resolve("/base/ext/a")).toBe("https://nitro.build/a");
    expect(resolve("/base/cdn/a")).toBe("//cdn.nitro.build/a");
  });

  it("scopes method-scoped rules to their methods", async () => {
    const routes = await buildRoutes({
      routeRules: {
        "GET /old/**": { redirect: { to: "/new/**", status: 302 } },
        "POST /form": { redirect: { to: "/thanks", status: 303 } },
        "/old/**": { redirect: { to: "/all", status: 302 } },
        "GET /hdr/**": { headers: { "x-get": "1" } },
        "/hdr/**": { headers: { "x-hdr": "1" } },
      },
    });
    const matches = (path: string) =>
      routes.filter((r) => r.src && !r.continue && new RegExp(r.src).test(path));
    expect(matches("/old/a").map((r) => [r.methods, r.headers?.Location])).toEqual([
      [["GET", "HEAD"], "/new/$1"],
      [undefined, "/all"],
      [undefined, undefined],
    ]);
    expect(matches("/form")[0]).toMatchObject({ methods: ["POST"], status: 303 });
    expect(
      routes.filter((r) => r.headers && r.continue && new RegExp(r.src!).test("/hdr/a"))
    ).toEqual([
      expect.objectContaining({ headers: { "x-hdr": "1" } }),
      expect.objectContaining({ headers: { "x-get": "1" }, methods: ["GET", "HEAD"] }),
    ]);
  });
});

describe("sortRoutes", () => {
  it("ranks method-scoped keys by their path", () => {
    expect(sortRoutes(["/a/**", "GET /a/**", "POST /a/b", "/**"])).toEqual([
      "POST /a/b",
      "GET /a/**",
      "/a/**",
      "/**",
    ]);
  });

  it("ranks HEAD before GET for the same path", () => {
    expect(sortRoutes(["HEAD /a", "/a", "GET /a"])).toEqual(["HEAD /a", "GET /a", "/a"]);
  });
});
