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
});

async function serveApp(
  opts: { buildPlugins?: boolean },
  fn: (ctx: { runner: unknown; text: (path: string) => Promise<string> }) => Promise<void>
) {
  const dir = await mkdtemp(join(tmpdir(), "nitro-serve-"));
  const plugin = /* js */ `{
    name: "test:async",
    transform: { filter: { id: /routes/ }, handler: async (code) => code.replace("__PLUGIN__", "(plugin)") },
  }`;
  await writeFile(
    join(dir, "nitro.config.mjs"),
    `export default { serverDir: "./", buildPlugins: [${opts.buildPlugins ? plugin : ""}] };`
  );
  await mkdir(join(dir, "routes"));
  await writeFile(join(dir, "routes/index.ts"), `export default () => "Served __PLUGIN__";`);
  await mkdir(join(dir, "public"));
  await writeFile(join(dir, "public/hello.txt"), "static asset");
  const server = await startUnbundledServer({
    rootDir: dir,
    listen: { port: 0, hostname: "127.0.0.1" },
  });
  try {
    const { host, port } = server.runner.address!;
    await fn({
      runner: server.runner,
      text: (path) => fetch(`http://${host}:${port}${path}`).then((res) => res.text()),
    });
  } finally {
    await server.close();
    await rm(dir, { recursive: true, force: true });
  }
}
