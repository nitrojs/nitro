import { cp, mkdir, mkdtemp, readFile, rm, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join, resolve } from "pathe";
import { build, createNitro, prepare, prerender } from "nitro/builder";
import type { Nitro, NitroBuildPlugin, NitroConfig } from "nitro/types";
import { frameworkProbePlugin, type ProbeGraph } from "./_probes.ts";
import { allFiles, fileManifest, inspectTransportedOutput } from "./_artifact.ts";
import { contractPlugins, type BuildOverrides } from "./_plugins.ts";
import { fixtureHooks } from "./_hooks.ts";
import { fixtureOutputConfig, type OutputOverrides } from "./_output.ts";

export const fixtureDir = fileURLToPath(new URL("fixture/", import.meta.url));
export const probePath = fileURLToPath(new URL("probe.mjs", import.meta.url));
const scratchDir = fileURLToPath(new URL(".tmp/", import.meta.url));
const cleanups: string[] = [];

export interface BuiltFixture {
  baseDir: string;
  outDir: string;
  cwd: string;
  entry: string;
  info: { taskEntry?: string; serverEntry?: string; preset: string };
  serverFiles: string[];
  serverManifest: Record<string, string>;
  serverBeforeManifest: Record<string, string>;
  counts: Record<string, number>;
  hookOrder: string[];
  probeGraphs: ProbeGraph[];
}

export async function buildFixture(
  options: BuildOverrides &
    OutputOverrides & {
      builder?: "rollup" | "rolldown" | "vite";
      preset?: "node" | "node-server" | "node-middleware" | "node-cluster";
      inline?: boolean;
      enabled?: boolean;
      empty?: boolean;
      probes?: boolean;
      boundary?: boolean;
      vite7?: boolean;
      noFastResponse?: boolean;
      beforeBuild?: (output: string) => Promise<void>;
      configure?: (nitro: Nitro) => void | Promise<void>;
      prerender?: boolean;
    } = {}
): Promise<BuiltFixture> {
  const builder =
    options.builder || (process.env.NITRO_BUILDER as "rollup" | "rolldown") || "rolldown";
  const baseDir = await mkdtemp(join(tmpdir(), "nitro task CLI 迁移 "));
  cleanups.push(baseDir);
  await mkdir(scratchDir, { recursive: true });
  const sourceDir = await mkdtemp(join(scratchDir, "source-"));
  cleanups.push(sourceDir);
  await cp(fixtureDir, sourceDir, { recursive: true });
  const buildOutput = join(baseDir, "original output");
  const counts = { before: 0, config: 0, compiled: 0, close: 0 };
  const hookOrder: string[] = [];
  const probeGraphs: ProbeGraph[] = [];
  let primaryDir = "";
  let serverBeforeManifest: Record<string, string> = {};
  const snapshotPlugin: NitroBuildPlugin = {
    name: "fixture:task-cli-primary-snapshot",
    async writeBundle(output: { dir?: string }) {
      if (output.dir && resolve(output.dir) === resolve(primaryDir)) {
        serverBeforeManifest = await fileManifest(primaryDir);
      }
    },
  };
  const config: NitroConfig = {
    rootDir: sourceDir,
    serverDir: options.empty ? false : "server",
    preset: options.preset || "node-server",
    builder,
    buildDir: join(baseDir, ".nitro"),
    output: {
      dir: buildOutput,
      ...(options.customOutput ? { serverDir: join(buildOutput, "server 内容") } : {}),
    },
    compatibilityDate: "2026-10-29",
    experimental: { tasks: true, taskCLI: options.enabled !== false },
    ...(options.boundary ? { plugins: [join(sourceDir, "boundary-plugin.ts")] } : {}),
    features: { websocket: true },
    runtimeConfig: { sample: { label: "from build", nested: { enabled: true } } },
    polyfills: options.noFastResponse ? ["!#nitro/runtime/polyfills/fast-response"] : [],
    ...(builder !== "vite"
      ? {
          alias: { "task-cli-fixture-alias": join(sourceDir, "alias.ts") },
          replace: {
            __TASK_CLI_FIXTURE_DEFINE__: JSON.stringify("vite define"),
            "import.meta.env.TASK_CLI_VALUE": JSON.stringify("standalone environment"),
          },
        }
      : {}),
    tasks: options.empty
      ? {}
      : {
          "echo:payload": { description: "Configured echo metadata" },
          "constructor:echo": { handler: join(sourceDir, "server/tasks/echo/payload.ts") },
          unimplemented: { description: "No implementation" },
        },
    scheduledTasks: options.empty ? {} : { "0 0 1 1 *": ["unselected"] },
    inlineDynamicImports: options.inline,
    ...(options.prerender
      ? { prerender: { routes: ["/probe"], crawlLinks: false, failOnError: true } }
      : {}),
    rollupConfig: fixtureOutputConfig(options),
    ...(options.vite7 ? { vite: { path: resolve("node_modules/vite7") } } : {}),
    buildPlugins: [
      snapshotPlugin,
      ...(options.probes ? [frameworkProbePlugin(probeGraphs)] : []),
      ...contractPlugins(options),
      ...(builder !== "vite"
        ? [
            {
              name: "fixture:task-cli-virtual",
              resolveId(id: string) {
                if (id === "virtual:task-cli-fixture") return "\0task-cli-fixture";
              },
              load(id: string) {
                if (id === "\0task-cli-fixture") return 'export default "virtual value"';
              },
            },
          ]
        : []),
    ],
    hooks: fixtureHooks({ counts, hookOrder }, options),
  };
  const nitro = await createNitro(config);
  if (!options.empty) {
    // defu filters constructor from config; resolved options can still register it.
    Object.defineProperty(nitro.options.tasks, "constructor", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: { handler: join(sourceDir, "server/tasks/echo/payload.ts") },
    });
  }
  try {
    await options.configure?.(nitro);
    primaryDir = nitro.options.output.serverDir;
    await prepare(nitro);
    await options.beforeBuild?.(buildOutput);
    if (options.prerender && builder !== "vite") await prerender(nitro);
    await build(nitro);
  } finally {
    await nitro.close();
    await rm(sourceDir, { recursive: true, force: true });
  }
  const outDir = join(baseDir, "only production 产物");
  await cp(buildOutput, outDir, { recursive: true });
  await rm(buildOutput, { recursive: true, force: true });
  await rm(join(baseDir, ".nitro"), { recursive: true, force: true });
  await inspectTransportedOutput(outDir);
  const cwd = join(baseDir, "unrelated cwd 空");
  await mkdir(cwd);
  const info = JSON.parse(await readFile(join(outDir, "nitro.json"), "utf8"));
  const serverDir = join(outDir, options.customOutput ? "server 内容" : "server");
  const serverFiles = await allFiles(serverDir);
  const serverManifest = await fileManifest(serverDir);
  return {
    baseDir,
    outDir,
    cwd,
    info,
    counts,
    hookOrder,
    probeGraphs,
    serverManifest,
    serverBeforeManifest,
    entry: join(outDir, "tasks/index.mjs"),
    serverFiles,
  };
}

export async function cleanupFixtures() {
  for (const dir of cleanups.splice(0)) await rm(dir, { recursive: true, force: true });
  await rmdir(scratchDir).catch(() => {});
}
