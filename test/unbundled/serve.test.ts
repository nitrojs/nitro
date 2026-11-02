import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { NodeWorkerEnvRunner } from "env-runner/runners/node-worker";
import { SelfEnvRunner } from "env-runner/runners/self";
import { join } from "pathe";
import { describe, expect, it } from "vitest";
import { startUnbundledServer } from "../../src/build/unbundled/serve.ts";

// In order: only the first server of the process can run on the self runner
describe("nitro serve runner", () => {
  it("runs in a worker with `buildPlugins`", async () => {
    await serveApp({ buildPlugins: true }, async ({ runner, text }) => {
      expect(runner).toBeInstanceOf(NodeWorkerEnvRunner);
      expect(await text("/")).toBe("Served (plugin)");
    });
  });

  it("runs in the process without `buildPlugins`", async () => {
    await serveApp({}, async ({ runner, text }) => {
      expect(runner).toBeInstanceOf(SelfEnvRunner);
      expect(await text("/")).toBe("Served __PLUGIN__");
      expect(await text("/hello.txt")).toBe("static asset");
    });
  });

  it("runs later servers of the process in a worker", async () => {
    await serveApp({}, async ({ runner, text }) => {
      expect(runner).toBeInstanceOf(NodeWorkerEnvRunner);
      expect(await text("/")).toBe("Served __PLUGIN__");
    });
  });

  it("applies the env name and its overrides", async () => {
    await serveApp({ envName: "staging" }, async ({ fetch }) => {
      const res = await fetch("/env");
      expect(await res.text()).toBe("staging");
      expect(res.headers.get("x-env")).toBe("staging");
    });
  });
});

async function serveApp(
  opts: { buildPlugins?: boolean; envName?: string },
  fn: (ctx: {
    runner: unknown;
    text: (path: string) => Promise<string>;
    fetch: (path: string) => Promise<Response>;
  }) => Promise<void>
) {
  const dir = await mkdtemp(join(tmpdir(), "nitro-serve-"));
  const plugin = /* js */ `{
    name: "test:async",
    transform: { filter: { id: /routes/ }, handler: async (code) => code.replace("__PLUGIN__", "(plugin)") },
  }`;
  await writeFile(
    join(dir, "nitro.config.mjs"),
    `export default { serverDir: "./", buildPlugins: [${opts.buildPlugins ? plugin : ""}], $env: { staging: { routeRules: { "/env": { headers: { "x-env": "staging" } } } } } };`
  );
  await mkdir(join(dir, "routes"));
  await writeFile(join(dir, "routes/index.ts"), `export default () => "Served __PLUGIN__";`);
  await writeFile(join(dir, "routes/env.ts"), `export default () => import.meta.envName;`);
  await mkdir(join(dir, "public"));
  await writeFile(join(dir, "public/hello.txt"), "static asset");
  const server = await startUnbundledServer({
    rootDir: dir,
    envName: opts.envName,
    listen: { port: 0, hostname: "127.0.0.1" },
  });
  try {
    const { host, port } = server.runner.address!;
    // `port: 0` listens on a random port, not on the 3000 default
    expect(port).not.toBe(3000);
    const _fetch = (path: string) => fetch(`http://${host}:${port}${path}`);
    await fn({
      runner: server.runner,
      fetch: _fetch,
      text: (path) => _fetch(path).then((res) => res.text()),
    });
  } finally {
    await server.close();
    await rm(dir, { recursive: true, force: true });
  }
}
