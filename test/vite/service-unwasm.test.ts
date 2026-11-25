import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import { getRandomPort } from "get-port-please";
import { Miniflare } from "miniflare";
import { join } from "pathe";
import { afterAll, describe, expect, it } from "vitest";
import { build, createNitro, prepare } from "nitro/builder";
import { nitro } from "nitro/vite";
import type { ViteDevServer } from "vite";
import { waitForServer } from "../presets/_wait-for-server.ts";

const { createServer } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

const rootDir = fileURLToPath(new URL("./service-unwasm-fixture", import.meta.url));

// #5150: service environments resolve the `unwasm` condition (a raw `.wasm` export) but only the
// `nitro` environment runs the unwasm plugin, so `vite build` fails while bundling the dependency.
describe("vite: service environments bundle `unwasm` exports", { concurrent: false }, () => {
  const originalCwd = process.cwd();

  afterAll(() => {
    process.chdir(originalCwd);
  });

  async function text(
    fetchServer: (req: Request) => Promise<{ status: number; text: () => Promise<string> }>,
    path: string
  ) {
    const res = await fetchServer(new Request(`http://localhost${path}`));
    expect(res.status).toBe(200);
    return res.text();
  }

  describe("dev", () => {
    let server: ViteDevServer;
    let serverURL: string;

    afterAll(async () => {
      await server?.close();
    });

    it("runs the bundled dependency in the nitro and service environments", async () => {
      process.chdir(rootDir);
      server = await createServer({ root: rootDir, logLevel: "warn" });
      await server.listen("0" as unknown as number);
      const addr = server.httpServer?.address() as {
        port: number;
        address: string;
        family: string;
      };
      serverURL = `http://${addr.family === "IPv6" ? `[${addr.address}]` : addr.address}:${addr.port}`;
      const fetchServer = (req: Request) =>
        fetch(new Request(serverURL + new URL(req.url).pathname));
      expect(
        server.environments.ssr.plugins.filter((plugin) => plugin.name === "unwasm")
      ).toHaveLength(1);
      expect(server.environments.client.plugins.map((plugin) => plugin.name)).not.toContain(
        "unwasm"
      );
      expect(await text(fetchServer, "/")).toBe("2+3=5");
      expect(await text(fetchServer, "/service")).toBe("2+3=5");
    }, 60_000);

    it("does not run unwasm in service environments when wasm is disabled", async () => {
      process.chdir(rootDir);
      const disabled = await createServer({
        root: rootDir,
        configFile: false,
        logLevel: "error",
        plugins: [
          nitro({
            wasm: false,
            serverDir: "./",
            services: { ssr: { entry: "./service.ts" } },
          }),
        ],
      });
      try {
        const names = disabled.environments.ssr.plugins.map((plugin) => plugin.name);
        expect(names).not.toContain("unwasm");
        const conditions = disabled.environments.ssr.config.resolve.conditions || [];
        expect(conditions).not.toContain("wasm");
        expect(conditions).not.toContain("unwasm");
      } finally {
        await disabled.close();
      }
    });
  });

  describe("build", () => {
    async function buildFixture(preset: string) {
      const outDir = join(rootDir, ".output", preset);
      await rm(outDir, { recursive: true, force: true });
      process.chdir(rootDir);
      const nitro = await createNitro({
        rootDir,
        preset,
        output: { dir: outDir },
        builder: "vite",
        // @ts-expect-error for testing
        __vitePkg__: process.env.NITRO_VITE_PKG,
      });
      try {
        await prepare(nitro);
        await build(nitro);
      } finally {
        await nitro.close();
      }
      return outDir;
    }

    it("builds and runs on the node preset", async () => {
      const outDir = await buildFixture("node");
      const port = await getRandomPort();
      const child = execa(process.execPath, [join(outDir, "server/index.mjs")], {
        env: { ...process.env, PORT: String(port), NITRO_PORT: String(port) },
        reject: false,
      });
      const base = `http://127.0.0.1:${port}`;
      try {
        await waitForServer(base, child.nodeChildProcess);
        const fetchServer = (req: Request) => fetch(new Request(base + new URL(req.url).pathname));
        expect(await text(fetchServer, "/")).toBe("2+3=5");
        expect(await text(fetchServer, "/service")).toBe("2+3=5");
      } finally {
        child.kill("SIGKILL");
      }
    }, 60_000);

    it("builds and runs on the cloudflare_module preset", async () => {
      const outDir = await buildFixture("cloudflare-module");
      const mf = new Miniflare({
        modules: true,
        compatibilityDate: "2025-04-01",
        scriptPath: join(outDir, "server/index.mjs"),
        modulesRules: [{ type: "CompiledWasm", include: ["**/*.wasm"] }],
        compatibilityFlags: ["nodejs_compat", "no_nodejs_compat_v2"],
      });
      try {
        const fetchServer = (req: Request) => mf.dispatchFetch(req.url);
        expect(await text(fetchServer, "/")).toBe("2+3=5");
        expect(await text(fetchServer, "/service")).toBe("2+3=5");
      } finally {
        await mf.dispose();
      }
    }, 60_000);
  });
});
