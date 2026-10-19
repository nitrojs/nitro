import type { Nitro } from "nitro/types";
import type { Server } from "srvx";
import {
  build,
  createDevServer,
  createNitro,
  loadOptions,
  prepare,
  prerender,
  startPreview,
} from "nitro/builder";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { pkgDir } from "#nitro/meta";
import { getRandomPort } from "get-port-please";
import { join } from "pathe";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { unbundledPlugins } from "../../src/build/unbundled/plugins.ts";
import { startUnbundledServer } from "../../src/build/unbundled/serve.ts";

const rootDir = fileURLToPath(new URL("fixture", import.meta.url));

describe("builder: false", () => {
  describe("dev", () => {
    let nitro: Nitro;
    let server: Server;
    let reloads = 0;

    beforeAll(async () => {
      nitro = await createNitro({ rootDir, dev: true });
      const devServer = createDevServer(nitro);
      server = devServer.listen({ port: 0 });
      await server.ready();
      const ready = new Promise<void>((resolve) => {
        nitro.hooks.hookOnce("dev:reload", () => resolve());
      });
      await build(nitro);
      await ready;
      nitro.hooks.hook("dev:reload", () => {
        reloads++;
      });
    });

    afterAll(async () => {
      await nitro?.close();
      await rm(join(rootDir, ".data"), { recursive: true, force: true });
      await rm(join(rootDir, "lib/_tmp.ts"), { force: true });
    });

    it("runs TypeScript sources with extensionless imports", async () => {
      const res = await fetch(new URL("/", server.url));
      expect(await res.text()).toBe("Hello, nitro!");
    });

    it("serves virtual modules (routing, runtime config)", async () => {
      const res = await fetch(new URL("/api/42", server.url));
      expect(await res.json()).toEqual({ id: "42", hasRuntimeConfig: true });
    });

    it("applies build transforms (TypeScript, import.meta, alias, text and wasm imports)", async () => {
      const res = await fetch(new URL("/features", server.url));
      expect(await res.json()).toEqual({
        dev: true,
        enum: "green",
        requestURL: "/features",
        text: "text asset",
        wasm: 5,
      });
    });

    it("applies `buildPlugins` (nested arrays and promises)", async () => {
      const res = await fetch(new URL("/build-plugins", server.url));
      expect(await res.json()).toEqual({
        message: "Hello from build plugin!",
        transform: "transformed",
        promise: "promise",
        nestedPromise: "nested-promise",
      });
    });

    it("runs the KV storage layer (optional runtime dependency)", async () => {
      const res = await fetch(new URL("/kv", server.url));
      expect(await res.json()).toEqual({ value: "bar" });
    });

    it("serves public assets", async () => {
      const res = await fetch(new URL("/hello.txt", server.url));
      expect(await res.text()).toContain("static asset");
    });

    it("restarts the worker on source changes only", async () => {
      reloads = 0;
      await mkdir(join(rootDir, ".data"), { recursive: true });
      await writeFile(join(rootDir, ".data/state.json"), "{}");
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(reloads).toBe(0);

      await writeFile(join(rootDir, "lib/_tmp.ts"), "export {};");
      await expect.poll(() => reloads, { timeout: 5000 }).toBeGreaterThan(0);
    });
  });

  it("warns about `buildPlugins` hooks env-runner does not support", async () => {
    const nitro = await createNitro({
      rootDir,
      buildPlugins: [
        {
          name: "fixture:unsupported",
          apply: () => true,
          buildStart() {},
          transform: (code) => code,
        },
      ],
    });
    const warn = vi.spyOn(nitro.logger, "warn").mockImplementation(() => {});
    await unbundledPlugins(nitro);
    expect(warn).toHaveBeenCalledWith(
      "Build plugin `fixture:unsupported` uses hooks not supported with `builder: false`, they are ignored: `buildStart`."
    );
    await nitro.close();
  });

  it("resolves optional runtime dependencies of the runtime from the project", async () => {
    const nitro = await createNitro({ rootDir });
    const plugin = (await unbundledPlugins(nitro)).find((p) => p.name === "nitro:runtime-deps");
    const { handler } = plugin!.resolveId as { handler: (...args: any[]) => Promise<unknown> };
    const resolve = vi.fn(async () => ({ id: "/resolved", external: false }));

    // Imported by user code (or dependencies): the runtime error is kept
    const userImporter = join(tmpdir(), "app/server.ts");
    expect(await handler.call({ resolve }, "unstorage", userImporter)).toBeUndefined();
    expect(resolve).not.toHaveBeenCalled();

    // Imported by the Nitro runtime: resolved from the project
    const runtimeImporter = join(pkgDir, "dist/runtime/internal/kv.mjs");
    expect(await handler.call({ resolve }, "unstorage/tracing", runtimeImporter)).toEqual({
      id: "/resolved",
      external: false,
    });
    expect(resolve).toHaveBeenCalledWith("unstorage/tracing", join(nitro.options.rootDir, "_"));
    await nitro.close();
  });

  it("maps `NITRO_BUILDER=false` to `builder: false`", async () => {
    const original = process.env.NITRO_BUILDER;
    process.env.NITRO_BUILDER = "false";
    try {
      const options = await loadOptions({ rootDir: join(rootDir, "../..", "fixture") });
      expect(options.builder).toBe(false);
    } finally {
      if (original === undefined) {
        delete process.env.NITRO_BUILDER;
      } else {
        process.env.NITRO_BUILDER = original;
      }
    }
  });

  it("does not support production builds (before cleaning the output)", async () => {
    const nitro = await createNitro({ rootDir });
    await mkdir(nitro.options.output.dir, { recursive: true });
    await expect(prepare(nitro)).rejects.toThrow("not supported with `builder: false`");
    await expect(build(nitro)).rejects.toThrow("not supported with `builder: false`");
    expect(existsSync(nitro.options.output.dir)).toBe(true);
    await rm(nitro.options.output.dir, { recursive: true, force: true });
    await nitro.close();
  });

  it("previews only the build output", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nitro-unbundled-"));
    await writeFile(join(dir, "nitro.config.mjs"), `export default { builder: false };`);
    await expect(startPreview({ rootDir: dir })).rejects.toThrow("Make sure to build first");
    await rm(dir, { recursive: true, force: true });
  });

  it("serves the sources from a public worker listener (`nitro serve`)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nitro-unbundled-"));
    await writeFile(
      join(dir, "nitro.config.mjs"),
      `export default { builder: "rollup", serverDir: "./", baseURL: "/app/", ignore: ["**/docs.html", "**/secret"] };`
    );
    await mkdir(join(dir, "routes"));
    await writeFile(join(dir, "routes/index.ts"), `export default () => "Served!";`);
    await writeFile(join(dir, "routes/[...path].ts"), `export default () => "Route!";`);
    await mkdir(join(dir, "public/docs"), { recursive: true });
    await writeFile(join(dir, "public/hello.txt"), "static asset");
    await writeFile(join(dir, "public/a b.txt"), "encoded asset");
    await writeFile(join(dir, "public/about.html"), "about page");
    await writeFile(join(dir, "public/docs/index.html"), "docs page");
    await writeFile(join(dir, "public/docs.html"), "ignored");
    await writeFile(join(dir, "public/secret"), "ignored");
    await writeFile(join(dir, "public/secret.html"), "secret page");
    const server = await startUnbundledServer({
      rootDir: dir,
      listen: { port: 0, hostname: "127.0.0.1" },
    });
    try {
      const { host, port } = server.runner.address!;
      const url = `http://${host}:${port}`;
      const text = (path: string) => fetch(`${url}${path}`).then((r) => r.text());
      expect(await text("/app/")).toBe("Served!");
      expect(await text("/app/hello.txt")).toBe("static asset");
      expect(await text("/app/a%20b.txt")).toBe("encoded asset");
      expect(await text("/app/about")).toBe("about page");
      expect(await text("/app/docs/")).toBe("docs page");
      expect(await text("/app/docs")).toBe("docs page");
      expect(await text("/app/secret")).toBe("secret page");
      expect(await text("/app/missing.txt")).toBe("Route!");
      const post = await fetch(`${url}/app/hello.txt`, { method: "POST" });
      expect(await post.text()).toBe("Route!");
    } finally {
      await server.close();
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("does not serve ignored public files at the root base (`nitro serve`)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nitro-unbundled-"));
    await writeFile(
      join(dir, "nitro.config.mjs"),
      `export default { serverDir: "./", ignore: ["**/docs.html", "**/secret", "**/note.txt"] };`
    );
    await mkdir(join(dir, "routes"));
    await writeFile(join(dir, "routes/[...path].ts"), `export default () => "Route!";`);
    await mkdir(join(dir, "public/docs"), { recursive: true });
    await writeFile(join(dir, "public/docs.html"), "ignored");
    await writeFile(join(dir, "public/docs/index.html"), "docs page");
    await writeFile(join(dir, "public/secret"), "ignored");
    await writeFile(join(dir, "public/secret.html"), "secret page");
    await writeFile(join(dir, "public/note.txt"), "ignored");
    await writeFile(join(dir, "public/note.txt.html"), "note page");
    const server = await startUnbundledServer({
      rootDir: dir,
      listen: { port: 0, hostname: "127.0.0.1" },
    });
    try {
      const { host, port } = server.runner.address!;
      const text = (path: string) => fetch(`http://${host}:${port}${path}`).then((r) => r.text());
      expect(await text("/docs")).toBe("docs page");
      expect(await text("/docs/")).toBe("docs page");
      expect(await text("/docs.html")).toBe("Route!");
      expect(await text("/secret")).toBe("secret page");
      expect(await text("/%73ecret")).toBe("secret page");
      expect(await text("/note.txt")).toBe("note page");
    } finally {
      await server.close();
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("listens on `NITRO_PORT` from `.env` (`nitro serve`)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nitro-unbundled-"));
    const envPort = await getRandomPort("127.0.0.1");
    await writeFile(join(dir, "nitro.config.mjs"), `export default { serverDir: "./" };`);
    await writeFile(join(dir, ".env"), `NITRO_PORT=${envPort}`);
    await mkdir(join(dir, "routes"));
    await writeFile(join(dir, "routes/index.ts"), `export default () => "Served!";`);
    const server = await startUnbundledServer({ rootDir: dir, listen: { hostname: "127.0.0.1" } });
    try {
      expect(server.runner.address?.port).toBe(envPort);
    } finally {
      delete process.env.NITRO_PORT;
      await server.close();
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("runs the build hooks of modules (`nitro serve`)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nitro-unbundled-"));
    await writeFile(
      join(dir, "nitro.config.mjs"),
      /* js */ `
import { writeFileSync } from "node:fs";
export default {
  modules: [{
    setup(nitro) {
      nitro.hooks.hook("build:before", () => {
        nitro.options.handlers.push({ route: "/from-module", handler: nitro.options.rootDir + "/module-handler.ts" });
      });
      nitro.hooks.hook("compiled", () => writeFileSync(nitro.options.rootDir + "/compiled.txt", "yes"));
    },
  }],
};`
    );
    await writeFile(join(dir, "module-handler.ts"), `export default () => "From module!";`);
    const server = await startUnbundledServer({
      rootDir: dir,
      listen: { port: 0, hostname: "127.0.0.1" },
    });
    try {
      const { host, port } = server.runner.address!;
      const res = await fetch(`http://${host}:${port}/from-module`);
      expect(await res.text()).toBe("From module!");
      expect(existsSync(join(dir, "compiled.txt"))).toBe(true);
    } finally {
      await server.close();
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("prerenders the sources without a build", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "nitro-unbundled-prerender-"));
    const nitro = await createNitro({
      rootDir,
      output: { dir: outputDir },
      prerender: { routes: ["/", "/api/7", "/features"] },
    });
    try {
      await prerender(nitro);
      const publicDir = nitro.options.output.publicDir;
      expect(await readFile(join(publicDir, "index"), "utf8")).toBe("Hello, nitro!");
      expect(JSON.parse(await readFile(join(publicDir, "api/7"), "utf8"))).toEqual({
        id: "7",
        hasRuntimeConfig: true,
      });
      expect(JSON.parse(await readFile(join(publicDir, "features"), "utf8"))).toMatchObject({
        dev: false,
        enum: "green",
        text: "text asset",
        wasm: 5,
      });
    } finally {
      await nitro.close();
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  it("prerenders filenames containing `..` but not `..` segments", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "nitro-unbundled-prerender-"));
    const nitro = await createNitro({
      rootDir,
      output: { dir: outputDir },
      prerender: {
        routes: ["/api/hello..png", "/api/7/../8", "/api/7\\..\\9"],
      },
    });
    try {
      await prerender(nitro);
      const publicDir = nitro.options.output.publicDir;
      expect(JSON.parse(await readFile(join(publicDir, "api/hello..png"), "utf8"))).toMatchObject({
        id: "hello..png",
      });
      expect(existsSync(join(publicDir, "api/8"))).toBe(false);
      expect(existsSync(join(publicDir, "api/9"))).toBe(false);
    } finally {
      await nitro.close();
      await rm(outputDir, { recursive: true, force: true });
    }
  });
});
