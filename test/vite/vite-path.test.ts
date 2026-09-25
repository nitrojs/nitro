import { mkdir, readFile, rm, symlink } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { nitro } from "nitro/vite";

const runningPkg = process.env.NITRO_VITE_PKG || "vite";
const otherPkg = runningPkg === "vite7" ? "vite" : "vite7";
const { createServer, version } = (await import(runningPkg)) as typeof import("vite");

const rootDir = fileURLToPath(new URL("./vite-path-fixture", import.meta.url));

// #4636: a framework running Vite programmatically (a monorepo where another `vite` is hoisted
// next to the app) needs the plugin to use *its* `vite`, not the one resolvable from the app root.
describe("vite:path", { sequential: true }, () => {
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

  afterAll(async () => {
    await server?.close();
    process.chdir(originalCwd);
    await rm(`${rootDir}/node_modules`, { recursive: true, force: true });
  });

  test("dev worker uses the module runner of the provided vite", async () => {
    server = await createServer({
      root: rootDir,
      logLevel: "warn",
      plugins: [
        nitro({
          serverDir: "./",
          serveStatic: false,
          vite: { path: import.meta.resolve(runningPkg) },
        }),
      ],
    });
    await server.listen("0" as unknown as number);
    const addr = server.httpServer?.address() as { port: number; address: string; family: string };
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
  }, 30_000);
});
