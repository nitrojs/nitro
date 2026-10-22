import { mkdir, readFile, rm, symlink } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ViteDevServer } from "vite";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { consola } from "consola";
import { nitro } from "../../src/vite.ts";
import type { NitroConfig } from "nitro/types";

const oxcPaths = vi.hoisted(() => [] as (Record<string, string> | undefined)[]);
vi.mock("../../src/utils/oxc.ts", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../src/utils/oxc.ts")>();
  return {
    ...mod,
    importOXC: (opts?: Parameters<typeof mod.importOXC>[0]) => {
      oxcPaths.push(opts?.paths);
      return mod.importOXC(opts);
    },
  };
});

const runningPkg = process.env.NITRO_VITE_PKG || "vite";
const otherPkg = runningPkg === "vite7" ? "vite" : "vite7";
const { createBuilder, createServer, version } = (await import(
  runningPkg
)) as typeof import("vite");

const rootDir = fileURLToPath(new URL("./vite-path-fixture", import.meta.url));

// #4636: a framework running Vite programmatically (a monorepo where another `vite` is hoisted
// next to the app) needs the plugin to use *its* `vite`, not the one resolvable from the app root.
describe("vite:path", { concurrent: false }, () => {
  const originalCwd = process.cwd();
  let server: ViteDevServer | undefined;

  beforeAll(async () => {
    // Make the other `vite` the one resolvable from the fixture root
    const otherDir = dirname(fileURLToPath(import.meta.resolve(`${otherPkg}/package.json`)));
    await rm(`${rootDir}/node_modules`, { recursive: true, force: true });
    await mkdir(`${rootDir}/node_modules`, { recursive: true });
    await symlink(otherDir, `${rootDir}/node_modules/vite`, "junction");
    process.chdir(rootDir);
  });

  beforeEach(() => {
    oxcPaths.length = 0;
  });

  afterAll(async () => {
    await server?.close();
    process.chdir(originalCwd);
    await rm(`${rootDir}/node_modules`, { recursive: true, force: true });
  });

  test.each([
    ["provided vite", { path: import.meta.resolve(runningPkg) }],
    ["running vite", undefined],
  ])(
    "dev worker uses the module runner of the %s",
    async (_, vite) => {
      await server?.close();
      server = await createServer({
        root: rootDir,
        logLevel: "warn",
        plugins: [nitro({ serverDir: "./", serveStatic: false, vite })],
      });
      await server.listen("0" as unknown as number);
      const addr = server.httpServer?.address() as {
        port: number;
        address: string;
        family: string;
      };
      const serverURL = `http://${addr.family === "IPv6" ? `[${addr.address}]` : addr.address}:${addr.port}`;

      const response = await fetch(`${serverURL}/`);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("vite-path:ok");

      const entry = await readFile(`${rootDir}/node_modules/.nitro/vite/dev-worker.mjs`, "utf8");
      const moduleRunner = entry.match(/import \* as moduleRunner from "([^"]+)"/)?.[1];
      const pkg = JSON.parse(
        await readFile(fileURLToPath(new URL("../../package.json", moduleRunner)), "utf8")
      ) as { name: string; version: string };
      expect(pkg.name).toBe("vite");
      expect(pkg.version).toBe(version);
    },
    30_000
  );

  test("warns about another explicit vite once across restarts", async () => {
    await server?.close();
    const warnings: string[] = [];
    const originalReporters = [...consola.options.reporters];
    consola.setReporters([
      {
        log: (logObj) => {
          if (logObj.type === "warn") {
            warnings.push(logObj.args.join(" "));
          }
        },
      },
    ]);
    try {
      server = await createServer({
        root: rootDir,
        logLevel: "warn",
        plugins: [
          nitro({
            serverDir: "./",
            serveStatic: false,
            vite: { path: import.meta.resolve(otherPkg) },
          }),
        ],
      });
      await server.restart();
    } finally {
      consola.setReporters(originalReporters);
    }
    expect(warnings.filter((w) => w.includes("is running"))).toHaveLength(1);
  }, 30_000);

  // #4886: `rolldown` (and its oxc bindings) is resolved through the running `vite`
  const isRunningVite = (paths?: Record<string, string>) =>
    !!paths?.vite?.endsWith("/dist/client/env.mjs");

  test("dev build plugins load oxc through the running vite", async () => {
    await server?.close();
    server = await createServer({
      root: rootDir,
      logLevel: "warn",
      plugins: [nitro({ serverDir: "./", serveStatic: false })],
    });
    await server.listen("0" as unknown as number);
    const addr = server.httpServer?.address() as { port: number };
    expect(await fetch(`http://localhost:${addr.port}/`).then((r) => r.text())).toBe(
      "vite-path:ok"
    );
    expect(oxcPaths.some((paths) => isRunningVite(paths))).toBe(true);
  }, 30_000);

  test("prerenderer resolves rolldown through the running vite", async () => {
    await server?.close();
    server = undefined;
    let prerenderConfig: NitroConfig | undefined;
    const builder = await createBuilder({
      root: rootDir,
      logLevel: "warn",
      plugins: [
        nitro({
          serverDir: "./",
          output: { dir: `${rootDir}/node_modules/.output` },
          prerender: { routes: ["/"] },
          hooks: {
            "prerender:config": (config) => {
              prerenderConfig = config;
            },
          },
        }),
      ],
    });
    await builder.buildApp();
    expect(prerenderConfig?.builder).toBe("rolldown");
    expect(isRunningVite(prerenderConfig?.deps?.paths)).toBe(true);
  }, 60_000);
});
