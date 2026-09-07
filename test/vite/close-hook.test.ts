import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execa } from "execa";
import { isWindows } from "std-env";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "pathe";
import type { ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const { createServer } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

// #4586: stopping the Vite dev server must run the Nitro `close` hooks, both the build-time
// ones (`nitro({ hooks })`) and the runtime ones registered by server plugins in the dev worker.
describe("vite: close hooks", { sequential: true }, () => {
  let server: ViteDevServer;
  let serverURL: string;
  let logFile: string;
  let tmpDir: string;

  const rootDir = fileURLToPath(new URL("./close-hook-fixture", import.meta.url));
  const originalCwd = process.cwd();

  beforeAll(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "nitro-close-hook-"));
    logFile = join(tmpDir, "close.log");
    writeFileSync(logFile, "");
    process.env.NITRO_TEST_CLOSE_LOG = logFile;
    process.chdir(rootDir);
    server = await createServer({ root: rootDir, logLevel: "warn" });
    await server.listen("0" as unknown as number);
    const addr = server.httpServer?.address() as { port: number; address: string; family: string };
    serverURL = `http://${addr.family === "IPv6" ? `[${addr.address}]` : addr.address}:${addr.port}`;
  }, 30_000);

  afterAll(async () => {
    await server?.close().catch(() => {});
    process.chdir(originalCwd);
    delete process.env.NITRO_TEST_CLOSE_LOG;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("runs build-time and runtime close hooks on `server.close()`", async () => {
    // Make sure the dev worker actually evaluated the app (and its plugins).
    expect(await (await fetch(`${serverURL}/api/hello`)).text()).toContain("hello");

    await server.close();

    const log = readFileSync(logFile, "utf8").split("\n").filter(Boolean);
    expect(log).toContain("build:close");
    expect(log).toContain("runtime:close");
  }, 30_000);

  // Vite only installs a `SIGTERM` handler, so the `SIGINT` of a Ctrl+C has to be handled by
  // Nitro itself — this runs a real dev server in a child process and signals it.
  test.skipIf(isWindows)(
    "runs close hooks on SIGINT",
    async () => {
      const sigintLog = join(tmpDir, "sigint.log");
      writeFileSync(sigintLog, "");
      const script = join(tmpDir, "dev.mjs");
      writeFileSync(
        script,
        [
          `import { createServer } from ${JSON.stringify(import.meta.resolve(process.env.NITRO_VITE_PKG || "vite"))};`,
          `const server = await createServer({ root: ${JSON.stringify(rootDir)}, logLevel: "warn" });`,
          `await server.listen(0);`,
          `console.log("ready:" + server.httpServer.address().port);`,
        ].join("\n")
      );

      const child = execa(process.execPath, [script], {
        cwd: rootDir,
        env: { ...process.env, NITRO_TEST_CLOSE_LOG: sigintLog },
        reject: false,
      });

      let output = "";
      child.stdout!.on("data", (data) => (output += data));
      child.stderr!.on("data", (data) => (output += data));
      try {
        const deadline = Date.now() + 30_000;
        while (!/ready:\d+/.test(output) && Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 100));
        }
        const port = Number(output.match(/ready:(\d+)/)?.[1]);
        expect(port).toBeGreaterThan(0);
        expect(await (await fetch(`http://localhost:${port}/api/hello`)).text()).toContain("hello");

        child.kill("SIGINT");
        await child;

        const log = readFileSync(sigintLog, "utf8").split("\n").filter(Boolean);
        expect(log).toContain("build:close");
        expect(log).toContain("runtime:close");
      } finally {
        child.kill("SIGKILL");
      }
    },
    60_000
  );
});
