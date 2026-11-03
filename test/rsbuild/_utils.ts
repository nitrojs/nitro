import type { RsbuildConfig } from "@rsbuild/core";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRsbuild } from "@rsbuild/core";
import { afterAll, beforeAll } from "vitest";

export const htmlHeaders = { accept: "text/html", "sec-fetch-dest": "document" };

export interface FixtureContext {
  url?: string;
  fetch: (path: string, init?: RequestInit) => Promise<Response>;
}

export interface FixtureOptions {
  /** Output dir of the production build (relative to the fixture). */
  outDir?: string;
  /** Serves the production build (default: imports the server entry). */
  serve?: (outDir: string) => Promise<FixtureContext & { close?: () => Promise<void> }>;
}

export function setupFixture(
  name: string,
  mode: "dev" | "prod",
  config: RsbuildConfig,
  { outDir = ".output", serve }: FixtureOptions = {}
) {
  const cwd = fileURLToPath(new URL(name, import.meta.url));
  const ctx = {} as FixtureContext;
  let close: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    await rm(join(cwd, outDir), { recursive: true, force: true });
    const rsbuild = await createRsbuild({
      cwd,
      config: { ...config, logLevel: "warn", server: { port: 0, host: "127.0.0.1" } },
    });
    if (mode === "dev") {
      const { urls, server } = await rsbuild.startDevServer({ getPortSilently: true });
      close = () => server.close();
      ctx.url = new URL(urls[0]!).origin;
      ctx.fetch = (path, init) => fetch(ctx.url + path, init);
      return;
    }
    await (await rsbuild.build()).close();
    if (serve) {
      const served = await serve(join(cwd, outDir));
      close = served.close;
      ctx.fetch = served.fetch;
      return;
    }
    delete (globalThis as any).__nitro__;
    const { default: server } = await import(join(cwd, outDir, "server/index.mjs"));
    ctx.fetch = (path, init) => server.fetch(new Request(new URL(path, "http://localhost"), init));
  }, 60_000);

  afterAll(async () => {
    await close?.();
  });

  return ctx;
}
