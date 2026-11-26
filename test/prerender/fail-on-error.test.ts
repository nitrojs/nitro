import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "pathe";
import { copyPublicAssets, createNitro, prepare, prerender } from "nitro/builder";
import type { NitroConfig, PrerenderRoute } from "nitro/types";
import { describe, expect, it } from "vitest";

const fixtureDir = fileURLToPath(new URL("./status-fixture", import.meta.url));

describe("prerender failOnError", () => {
  it("fails the build when a route errors", async () => {
    const { error } = await prerenderRoutes(["/", "/status/404"], { failOnError: true });
    expect(error).toMatchObject({ message: "Exiting due to prerender errors." });
  }, 120_000);

  it("does not fail the build for errors with an ignored status code", async () => {
    const { error, nitro, failedRoutes } = await prerenderRoutes(["/", "/status/404"], {
      failOnError: true,
      ignoreStatusCodes: [404],
    });
    expect(error).toBeUndefined();
    expect(nitro._prerenderedRoutes!.map((r) => r.route)).toEqual(["/"]);
    // the route is still reported as failed and not written
    expect(failedRoutes.map((r) => [r.route, r.error?.status])).toEqual([["/status/404", 404]]);
  }, 120_000);

  it("still fails the build for errors with other status codes", async () => {
    const { error, logs } = await prerenderRoutes(["/", "/status/404", "/status/500"], {
      failOnError: true,
      ignoreStatusCodes: [404],
    });
    expect(error).toMatchObject({ message: "Exiting due to prerender errors." });
    // only the routes failing the build are listed
    const summary = logs
      .slice(logs.findIndex((l) => l.includes("Errors prerendering:")))
      .join("\n");
    expect(summary).toContain("/status/500");
    expect(summary).not.toContain("/status/404");
  }, 120_000);

  it("matches ignore patterns against decoded routes", async () => {
    const generated: string[] = [];
    const { error, nitro } = await prerenderRoutes(
      ["/private%20page"],
      { failOnError: true, ignore: ["/private page"] },
      {
        hooks: {
          "prerender:generate"(route) {
            generated.push(route.route);
          },
        },
      }
    );

    expect(error).toBeUndefined();
    expect(generated).toEqual([]);
    expect(nitro._prerenderedRoutes).toEqual([]);
  }, 120_000);

  it("records malformed route encodings as route failures", async () => {
    const { error, failedRoutes, nitro } = await prerenderRoutes(["/", "/bad%URI"], {
      failOnError: false,
    });

    expect(error).toBeUndefined();
    expect(nitro._prerenderedRoutes!.map((r) => r.route)).toEqual(["/"]);
    expect(failedRoutes.map((r) => [r.route, r.error?.message])).toEqual([
      ["/bad%URI", "URI malformed"],
    ]);
  }, 120_000);

  it("releases a failed write claim before rendering an alias", async () => {
    const { error, failedRoutes, nitro } = await prerenderRoutes(
      ["/", "/a", "/a/index.html"],
      { failOnError: false, concurrency: 1 },
      {
        hooks: {
          async "prerender:generate"(route, nitro) {
            if (route.route === "/a") {
              await mkdir(join(nitro.options.output.publicDir, route.fileName!), {
                recursive: true,
              });
            }
          },
        },
      }
    );

    expect(error).toBeUndefined();
    expect(nitro._prerenderedRoutes!.map((r) => r.route)).toEqual(["/"]);
    expect(failedRoutes.map((r) => r.route)).toEqual(["/a", "/a/index.html"]);
  }, 120_000);

  it("fails the build when route generation throws", async () => {
    const { error, failedRoutes } = await prerenderRoutes(
      ["/", "/throws"],
      { failOnError: true },
      {
        hooks: {
          "prerender:generate"(route) {
            if (route.route === "/throws") {
              throw new Error("Route generation failed");
            }
          },
        },
      }
    );
    expect(error).toMatchObject({ message: "Exiting due to prerender errors." });
    expect(failedRoutes.map((r) => [r.route, r.error?.message])).toEqual([
      ["/throws", "Route generation failed"],
    ]);
  }, 120_000);

  it("fails the build when generation throws for a route with an ignored status", async () => {
    const { error, failedRoutes } = await prerenderRoutes(
      ["/", "/status/404"],
      { failOnError: true, ignoreStatusCodes: [404] },
      {
        hooks: {
          "prerender:generate"(route) {
            if (route.route === "/status/404") {
              throw new Error("Route generation failed");
            }
          },
        },
      }
    );
    // The thrown error replaces the ignored 404, so it is not filtered out
    expect(error).toMatchObject({ message: "Exiting due to prerender errors." });
    expect(failedRoutes.map((r) => [r.route, r.error?.message])).toEqual([
      ["/status/404", "Route generation failed"],
    ]);
  }, 120_000);

  it("logs a route whose prerender:route hook throws", async () => {
    const { error, logs } = await prerenderRoutes(
      ["/", "/status/404"],
      { failOnError: false, ignoreStatusCodes: [404] },
      {
        hooks: {
          "prerender:route"(route) {
            if (route.route === "/status/404") {
              throw new Error("Route hook failed");
            }
          },
        },
      }
    );
    expect(error).toBeUndefined();
    expect(logs.filter((l) => l.includes("/status/404"))).toHaveLength(1);
  }, 120_000);

  it("records thrown route error in failedRoutes when failOnError is false", async () => {
    const { error, failedRoutes, nitro } = await prerenderRoutes(
      ["/", "/throws"],
      { failOnError: false },
      {
        hooks: {
          "prerender:generate"(route) {
            if (route.route === "/throws") {
              throw new Error("Route generation failed");
            }
          },
        },
      }
    );
    expect(error).toBeUndefined();
    expect(nitro._prerenderedRoutes!.map((r) => r.route)).toEqual(["/"]);
    expect(failedRoutes.map((r) => [r.route, r.error?.message])).toEqual([
      ["/throws", "Route generation failed"],
    ]);
  }, 120_000);
});

async function prerenderRoutes(
  routes: string[],
  options: NitroConfig["prerender"],
  config?: Partial<NitroConfig>
) {
  const outDir = await mkdtemp(join(tmpdir(), "nitro-prerender-errors-"));

  const nitro = await createNitro({
    rootDir: fixtureDir,
    preset: "static",
    output: { dir: outDir },
    prerender: { crawlLinks: false, routes, ...options },
    ...config,
  });

  const logs: string[] = [];
  nitro.logger.log = ((...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  }) as typeof nitro.logger.log;

  let failedRoutes: PrerenderRoute[] = [];
  nitro.hooks.hook("prerender:done", (result) => {
    failedRoutes = result.failedRoutes;
  });

  let error: unknown;
  try {
    await prepare(nitro);
    await copyPublicAssets(nitro);
    await prerender(nitro);
  } catch (error_) {
    error = error_;
  } finally {
    await nitro.close();
    await rm(outDir, { recursive: true, force: true });
  }

  return { nitro, logs, failedRoutes, error };
}
