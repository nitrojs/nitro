import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import { join } from "pathe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const cli = fileURLToPath(new URL("../../dist/cli/index.mjs", import.meta.url));

describe("nitro fetch", () => {
  let dir: string;
  const nitro = (args: string[], input?: string) =>
    execa("node", [cli, ...args, "--dir", dir], { reject: false, input });

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "nitro-fetch-"));
    await writeFile(join(dir, "nitro.config.mjs"), `export default { serverDir: "./" };`);
    await mkdir(join(dir, "routes"));
    await writeFile(
      join(dir, "routes/index.ts"),
      `export default () => { console.log("server log"); return { hello: "world" }; };`
    );
    await writeFile(
      join(dir, "routes/echo.post.ts"),
      `export default async ({ req }) => ({ type: req.headers.get("content-type"), body: await req.text() });`
    );
    await writeFile(
      join(dir, "routes/stream.ts"),
      /* js */ `export default () => new Response(new ReadableStream({
        async start(controller) {
          controller.enqueue(new TextEncoder().encode("a"));
          await new Promise((resolve) => setTimeout(resolve, 500));
          controller.enqueue(new TextEncoder().encode("b"));
          controller.close();
        },
      }));`
    );
    await mkdir(join(dir, "public"));
    await writeFile(join(dir, "public/hello.txt"), "static asset");
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("prints the body to stdout and the logs to stderr", async () => {
    const res = await nitro(["fetch", "/"]);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toBe(`{"hello":"world"}`);
    expect(res.stderr).toContain("server log");
  });

  it("serves public assets and includes the headers with `-i`", async () => {
    const res = await nitro(["curl", "-i", "/hello.txt"]);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toMatch(/^HTTP\/1\.1 200 OK\r\n/);
    expect(res.stdout).toContain("content-type: text/plain");
    expect(res.stdout).toMatch(/\r\n\r\nstatic asset$/);
  });

  it("sends the request body", async () => {
    const res = await nitro(["fetch", "/echo", "--json", '{"a":1}']);
    expect(JSON.parse(res.stdout)).toEqual({ type: "application/json", body: '{"a":1}' });
    const stdin = await nitro(["fetch", "/echo", "-d", "@-"], "a=1");
    expect(JSON.parse(stdin.stdout)).toMatchObject({ body: "a=1" });
  });

  it("streams the response", async () => {
    const subprocess = nitro(["fetch", "/stream"]);
    const firstChunk = new Promise((resolve) => subprocess.stdout.once("data", resolve));
    const res = await subprocess;
    expect(String(await firstChunk)).toBe("a");
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toBe("ab");
  });

  it("fails on error statuses, still printing the body", async () => {
    const res = await nitro(["fetch", "/missing"]);
    expect(res.exitCode).toBe(22);
    expect(JSON.parse(res.stdout)).toMatchObject({ status: 404 });
    expect(res.stderr).toContain("returned error: 404");
  });

  it("fails on invalid arguments", async () => {
    const res = await nitro(["fetch", "-L", "/"]);
    expect(res.exitCode).toBe(2);
    expect(res.stderr).toContain("-L");
  });
});
