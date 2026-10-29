import type { Nitro } from "nitro/types";
import { build, createDevServer, createNitro } from "nitro/builder";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import { join } from "pathe";
import { isWindows } from "std-env";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const cli = fileURLToPath(new URL("../../dist/cli/index.mjs", import.meta.url));

// Without `buildPlugins`, the server runs in the CLI process (self runner), else in a worker
describe.each(["self", "worker"])("nitro fetch (%s runner)", (runner) => {
  let dir: string;
  const nitro = (args: string[], input?: string) =>
    execa("node", [cli, ...args, "--dir", dir], { reject: false, input, stripFinalNewline: false });

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "nitro-fetch-"));
    const buildPlugins =
      runner === "worker" ? `[{ name: "test", transform: async () => {} }]` : "[]";
    await writeFile(
      join(dir, "nitro.config.mjs"),
      `export default { serverDir: "./", buildPlugins: ${buildPlugins} };`
    );
    await mkdir(join(dir, "routes"));
    await mkdir(join(dir, "plugins"));
    await writeFile(
      join(dir, "plugins/close.ts"),
      `export default (nitroApp) => nitroApp.hooks.hook("close", () => console.log("close hook"));`
    );
    await writeFile(
      join(dir, "routes/index.ts"),
      `export default () => { console.log("server log"); return { hello: "world" }; };`
    );
    await writeFile(
      join(dir, "routes/echo.ts"),
      /* js */ `export default async ({ req }) => ({
        url: req.url,
        headers: Object.fromEntries(req.headers),
        body: await req.text(),
      });`
    );
    await writeFile(join(dir, "routes/empty.ts"), `export default () => new Response(null);`);
    await writeFile(
      join(dir, "routes/redirect.ts"),
      `export default () => new Response(null, { status: 302, headers: { location: "/" } });`
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
    await writeFile(
      join(dir, "routes/endless.ts"),
      /* js */ `export default () => {
        let timer;
        return new Response(new ReadableStream({
          pull: (controller) => new Promise((resolve) => {
            timer = setTimeout(() => resolve(controller.enqueue(new TextEncoder().encode("x".repeat(1024)))), 10);
          }),
          cancel: () => clearTimeout(timer),
        }));
      };`
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
    expect(res.stderr).toContain("close hook");
  });

  it("serves public assets and includes the headers with `-i`", async () => {
    const res = await nitro(["curl", "-i", "/hello.txt"]);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toMatch(/^HTTP\/1\.1 200 OK\r\n/);
    expect(res.stdout).toContain("content-type: text/plain");
    expect(res.stdout).toMatch(/\r\n\r\nstatic asset$/);
  });

  it("does not follow redirects", async () => {
    const res = await nitro(["curl", "-i", "/redirect"]);
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toMatch(/^HTTP\/1\.1 302 /);
    expect(res.stdout).toContain("location: /");
  });

  it("prints only the headers with `-I`, and the request too with `-v`", async () => {
    const head = await nitro(["fetch", "-I", "/hello.txt"]);
    expect(head.stdout).toMatch(/^HTTP\/1\.1 200 OK\r\n[^]*\r\n\r\n$/);
    const endless = await nitro(["fetch", "-I", "-X", "GET", "/endless"]);
    expect(endless.exitCode).toBe(0);
    expect(endless.stdout).toMatch(/^HTTP\/1\.1 200 OK\r\n(?:.+\r\n)*\r\n$/);
    const verbose = await nitro(["fetch", "-v", "/hello.txt"]);
    expect(verbose.stdout).toBe("static asset");
    expect(verbose.stderr).toContain("> GET /hello.txt HTTP/1.1\n> host: localhost\n");
    expect(verbose.stderr).toContain("< HTTP/1.1 200 OK\n");
  });

  it("sends the request body and headers, with the URL host", async () => {
    const json = await nitro([
      "fetch",
      "/echo",
      "--json",
      '{"a":1}',
      "-H",
      "x-a: 1",
      "-H",
      "x-a: 2",
    ]);
    expect(JSON.parse(json.stdout)).toMatchObject({
      url: "http://localhost/echo",
      headers: { "content-type": "application/json", "x-a": "1, 2" },
      body: '{"a":1}',
    });
    const stdin = await nitro(["fetch", "http://example.com/echo?x=1", "-d", "@-"], "a=1");
    expect(JSON.parse(stdin.stdout)).toMatchObject({
      url: "http://example.com/echo?x=1",
      headers: { host: "example.com" },
      body: "a=1",
    });
    const host = await nitro(["fetch", "http://example.com/echo", "-H", "host: other"]);
    expect(JSON.parse(host.stdout)).toMatchObject({ headers: { host: "other" } });
  });

  it("writes the output to a file with `-o`", async () => {
    const file = join(dir, "out.txt");
    expect((await nitro(["fetch", "-o", file, "/hello.txt"])).exitCode).toBe(0);
    expect(await readFile(file, "utf8")).toBe("static asset");
    for (const args of [["/empty"], ["-I", "/hello.txt"]]) {
      const res = await nitro(["fetch", "-o", join(dir, "missing/out.txt"), ...args]);
      expect(res.exitCode).toBe(23);
      expect(res.stderr).toContain("ENOENT");
      expect(res.stderr).not.toContain("uncaught");
    }
  });

  it("streams the response", async () => {
    const subprocess = nitro(["fetch", "/stream"]);
    const firstChunk = new Promise((resolve) => subprocess.stdout.once("data", resolve));
    const res = await subprocess;
    expect(String(await firstChunk)).toBe("a");
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toBe("ab");
  });

  it("stops quietly when stdout is closed", async () => {
    const subprocess = nitro(["fetch", "/endless"]);
    subprocess.stdout.once("data", () => subprocess.stdout.destroy());
    const res = await subprocess;
    expect(res.exitCode).toBe(23);
    expect(res.stderr).not.toContain("EPIPE");
    expect(res.stderr).toContain("close hook");
  });

  // Signals can not be sent to a process on Windows (it is terminated)
  it.skipIf(isWindows)("stops on `SIGINT`", async () => {
    const subprocess = nitro(["fetch", "/endless"]);
    subprocess.stdout.once("data", () => subprocess.kill("SIGINT"));
    const res = await subprocess;
    expect(res.exitCode).toBe(130);
    expect(res.stderr).not.toContain("ERROR");
    expect(res.stderr).toContain("close hook");
  });

  it("fails on error statuses, still printing the body", async () => {
    const res = await nitro(["fetch", "/missing"]);
    expect(res.exitCode).toBe(22);
    expect(JSON.parse(res.stdout)).toMatchObject({ status: 404 });
    expect(res.stderr).toContain("returned error: 404");
    const silent = await nitro(["fetch", "-s", "/missing"]);
    expect(silent.exitCode).toBe(22);
    expect(silent.stderr).not.toContain("returned error");
  });

  it("fails on invalid arguments", async () => {
    const res = await nitro(["fetch", "-L", "/"]);
    expect(res.exitCode).toBe(2);
    expect(res.stderr).toContain("-L");
    const silent = await nitro(["fetch", "-s", "-d", "@missing.txt", "/"]);
    expect(silent.exitCode).toBe(2);
    expect(silent.stderr).toBe("");
  });
});

describe("nitro fetch (running dev server)", () => {
  let dir: string;
  let nitro: Nitro;
  let devURL: string;
  const fetchCLI = (args: string[]) =>
    execa("node", [cli, "fetch", ...args, "--dir", dir], { reject: false });

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "nitro-fetch-dev-"));
    await writeFile(
      join(dir, "nitro.config.mjs"),
      `export default { builder: false, serverDir: "./" };`
    );
    await mkdir(join(dir, "routes"));
    await writeFile(
      join(dir, "routes/mode.ts"),
      `export default ({ req }) => ({ dev: import.meta.dev, url: req.url });`
    );
    await mkdir(join(dir, "public"));
    await writeFile(join(dir, "public/hello.txt"), "static asset");

    await startDevServer();
  });

  async function startDevServer(envName?: string) {
    nitro = await createNitro({ rootDir: dir, dev: true }, { c12: { envName } });
    const server = createDevServer(nitro).listen({ port: 0, hostname: "127.0.0.1" });
    await server.ready();
    devURL = server.url!;
    const ready = new Promise<void>((resolve) =>
      nitro.hooks.hookOnce("dev:reload", () => resolve())
    );
    await build(nitro);
    await ready;
  }

  afterAll(async () => {
    await nitro?.close();
    await rm(dir, { recursive: true, force: true });
  });

  it("uses the running dev server", async () => {
    const res = await fetchCLI(["http://example.com/mode"]);
    expect(res.exitCode).toBe(0);
    expect(JSON.parse(res.stdout)).toEqual({ dev: true, url: "http://example.com/mode" });
    expect(res.stderr).toContain(`Using the running dev server at \`${devURL}\``);
    expect((await fetchCLI(["/hello.txt"])).stdout).toBe("static asset");
    const envName = await fetchCLI(["/mode", "--envName", "development"]);
    expect(JSON.parse(envName.stdout)).toMatchObject({ dev: true });
  });

  it("starts a server with `--no-dev` or another `--envName`", async () => {
    for (const args of [["--no-dev"], ["--envName", "production"]]) {
      const res = await fetchCLI(["/mode", ...args]);
      expect(JSON.parse(res.stdout)).toMatchObject({ dev: false });
      expect(res.stderr).not.toContain("dev server");
    }
  });

  it("starts a server once the dev server is closed", async () => {
    await nitro.close();
    const res = await fetchCLI(["/mode"]);
    expect(res.exitCode).toBe(0);
    expect(JSON.parse(res.stdout)).toMatchObject({ dev: false });
  });

  it("uses a dev server with a custom env name", async () => {
    await startDevServer("staging");
    const staging = await fetchCLI(["/mode", "--envName", "staging"]);
    expect(JSON.parse(staging.stdout)).toMatchObject({ dev: true });
    const development = await fetchCLI(["/mode", "--envName", "development"]);
    expect(JSON.parse(development.stdout)).toMatchObject({ dev: false });
  });
});
