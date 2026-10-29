import { fileURLToPath } from "node:url";
import { execa } from "execa";
import type { ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const { createServer } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

const cli = fileURLToPath(new URL("../../dist/cli/index.mjs", import.meta.url));

describe("vite: nitro fetch (running dev server)", () => {
  const rootDir = fileURLToPath(new URL("./fetch-fixture", import.meta.url));
  const originalCwd = process.cwd();
  let server: ViteDevServer;
  const fetchCLI = (args: string[]) =>
    execa("node", [cli, "fetch", ...args, "--dir", rootDir], { reject: false });

  beforeAll(async () => {
    process.chdir(rootDir);
    server = await createServer({ root: rootDir, logLevel: "warn" });
    await server.listen("0" as unknown as number);
  }, 30_000);

  afterAll(async () => {
    await server?.close();
    process.chdir(originalCwd);
  });

  it("uses the running dev server", async () => {
    const res = await fetchCLI(["/mode"]);
    expect(res.exitCode, res.stderr).toBe(0);
    expect(JSON.parse(res.stdout)).toEqual({ dev: true, url: "http://localhost/mode" });
    expect(res.stderr).toContain("Using the running dev server");
    expect((await fetchCLI(["/hello.txt"])).stdout).toBe("static asset");
    const envName = await fetchCLI(["/mode", "--envName", "development"]);
    expect(JSON.parse(envName.stdout)).toMatchObject({ dev: true });
  });

  it("starts a server once the dev server is closed", async () => {
    await server.close();
    const res = await fetchCLI(["/mode"]);
    expect(res.exitCode, res.stderr).toBe(0);
    expect(JSON.parse(res.stdout)).toMatchObject({ dev: false });
  });
});
