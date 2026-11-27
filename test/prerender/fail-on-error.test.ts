import { mkdtemp, rm } from "node:fs/promises";
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

  it("fails the build when fetching a route rejects even if `failOnError` is false", async () => {
    const { error, failedRoutes } = await prerenderRoutes(["/stream-error"], {
      failOnError: false,
    });
    expect(error).toMatchObject({ message: expect.stringContaining("Prerendered 0 routes.") });
    expect(failedRoutes.map((r) => r.route)).toEqual(["/stream-error"]);
    expect(failedRoutes[0]?.error).toBeInstanceOf(Error);
  }, 120_000);

  it("fails the build when a route rejection occurs alongside successful routes", async () => {
    const { error, nitro, failedRoutes, logs } = await prerenderRoutes(["/", "/stream-error"], {
      failOnError: true,
      ignoreStatusCodes: [404],
    });
    expect(error).toMatchObject({ message: "Exiting due to prerender errors." });
    expect(nitro._prerenderedRoutes!.map((r) => r.route)).toEqual(["/"]);
    expect(failedRoutes.map((r) => r.route)).toEqual(["/stream-error"]);
    const summary = logs
      .slice(logs.findIndex((l) => l.includes("Errors prerendering:")))
      .join("\n");
    expect(summary).toContain("/stream-error");
  }, 120_000);
});

async function prerenderRoutes(routes: string[], options: NitroConfig["prerender"]) {
  const outDir = await mkdtemp(join(tmpdir(), "nitro-prerender-errors-"));

  const nitro = await createNitro({
    rootDir: fixtureDir,
    preset: "static",
    output: { dir: outDir },
    prerender: { crawlLinks: false, routes, ...options },
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
