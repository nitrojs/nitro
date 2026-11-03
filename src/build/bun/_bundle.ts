import type { BunConfig, Nitro } from "nitro/types";
import type { RollupOutput } from "rollup";
import { writeOutput } from "./_output.ts";
import { isFile } from "./_hooks.ts";
import type { PluginContainer } from "./_plugins.ts";
import type { BunBuildMessage, BunBuildOutput } from "./_types.ts";

/** Bundles with `Bun.build` and writes the output to the server dir. */
export async function bundle(
  nitro: Nitro,
  config: BunConfig,
  container: PluginContainer
): Promise<{ output: RollupOutput; inputs: string[] }> {
  await container.buildStart();
  let result: BunBuildOutput;
  try {
    // Nitro writes the output itself (`outdir` is ignored), and reads module ids from the metafile
    const { outdir: _outdir, ...options } = config;
    result = await getBun().build({ ...options, metafile: true, throw: false });
    if (!result.success) {
      throw new AggregateError(
        result.logs,
        `Build failed:\n${result.logs.map((log) => formatLog(log)).join("\n")}`
      );
    }
  } catch (error) {
    await container.buildEnd(error);
    throw error;
  }
  await container.buildEnd();

  for (const log of result.logs) {
    if (log.level === "warning" || log.level === "error") {
      nitro.logger.warn(formatLog(log));
    } else {
      nitro.logger.debug(formatLog(log));
    }
  }

  const output = await writeOutput(container, {
    outputs: result.outputs,
    meta: (path) => result.metafile?.outputs[path],
    dir: nitro.options.output.serverDir,
    format: config.format === "cjs" || config.format === "iife" ? config.format : "es",
    sourcemap: !!nitro.options.sourcemap,
  });

  const inputs = [
    ...Object.keys(result.metafile?.inputs || {}).map((input) => container.moduleId(input)),
    ...container.watchFiles,
  ];
  return { output, inputs: inputs.filter((id) => isFile(id)) };
}

function getBun() {
  return (globalThis as any).Bun as { build: (config: BunConfig) => Promise<BunBuildOutput> };
}

function formatLog(log: BunBuildMessage): string {
  const position = log.position;
  return position
    ? `${log.message}\n    at ${position.file}:${position.line}:${position.column}`
    : log.message;
}
