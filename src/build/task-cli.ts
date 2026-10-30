import type { Nitro, NitroOptions } from "nitro/types";
import type { RollupBuild, RollupOptions, OutputOptions } from "rollup";
import type { RolldownBuild, RolldownOptions } from "rolldown";
import { mkdir } from "node:fs/promises";
import { join, relative } from "pathe";
import { presetsDir } from "#nitro/meta";
import {
  taskCLIBuildEnv,
  taskCLIPluginReplacements,
  replaceTaskCLIPlugins,
} from "./task-cli-plugins.ts";
import { taskCLIInputGuard, assertTaskCLIOutput } from "./task-cli-output.ts";
import { taskCLIOutputOptions } from "./task-cli-output-options.ts";

export async function createTaskCLIBuild(nitro: Nitro) {
  if (!nitro.options.experimental.taskCLI || nitro.options.dev || nitro.options.static) {
    return;
  }
  const dir = join(nitro.options.output.dir, "tasks");
  try {
    await mkdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(`Task CLI output directory already exists: ${dir}`);
    }
    throw error;
  }
  const entry = join(presetsDir, "node/runtime/task-cli");
  const output = {
    dir,
    format: "esm" as const,
    entryFileNames: "index.mjs",
    chunkFileNames: "chunks/[name]-[hash].mjs",
    assetFileNames: "assets/[name]-[hash][extname]",
    inlineDynamicImports: false,
  };
  const options: NitroOptions = {
    ...nitro.options,
    entry,
    output: { ...nitro.options.output, serverDir: dir },
    inlineDynamicImports: false,
    rollupConfig: { ...nitro.options.rollupConfig, input: entry, output },
    rolldownConfig: { ...nitro.options.rolldownConfig, input: entry, output },
  };
  return {
    nitro: { ...nitro, options, vfs: new Map() } as Nitro,
    dir,
    taskEntry: relative(nitro.options.output.dir, join(dir, "index.mjs")),
  };
}

type TaskBundler =
  | {
      builder: "rollup";
      bundler: typeof import("rollup");
      config: import("nitro/types").RollupConfig;
    }
  | {
      builder: "rolldown";
      bundler: typeof import("rolldown");
      config: RolldownOptions;
    };

/** A separate single-input bundle, without replaying the Nitro build lifecycle. */
export async function buildTaskCLI(nitro: Nitro, opts: TaskBundler) {
  const task = await createTaskCLIBuild(nitro);
  if (!task) return;
  const env = taskCLIBuildEnv(opts.config);
  let bundle: RollupBuild | RolldownBuild | undefined;
  try {
    if (opts.builder === "rollup") {
      const { getRollupConfig } = await import("./rollup/config.ts");
      const fresh = await getRollupConfig(task.nitro, env);
      const config = {
        ...opts.config,
        input: fresh.input,
        output: taskCLIOutputOptions(opts.config.output, fresh.output, "rollup", task.dir),
        plugins: [
          ...(await replaceTaskCLIPlugins(
            opts.config.plugins,
            taskCLIPluginReplacements(opts.config, fresh)
          )),
          taskCLIInputGuard(task.nitro.options.entry),
        ],
      };
      bundle = await opts.bundler.rollup(config as RollupOptions);
      assertTaskCLIOutput(
        await bundle.write(config.output as OutputOptions),
        task.nitro.options.entry
      );
    } else {
      const { getRolldownConfig } = await import("./rolldown/config.ts");
      const fresh = await getRolldownConfig(task.nitro, env);
      const config = {
        ...opts.config,
        input: fresh.input,
        output: taskCLIOutputOptions(opts.config.output, fresh.output, "rolldown", task.dir),
        plugins: [
          ...(await replaceTaskCLIPlugins(
            opts.config.plugins,
            taskCLIPluginReplacements(opts.config, fresh)
          )),
          taskCLIInputGuard(task.nitro.options.entry),
        ],
      };
      bundle = await opts.bundler.rolldown(config as RolldownOptions);
      assertTaskCLIOutput(
        await bundle.write(config.output as import("rolldown").OutputOptions),
        task.nitro.options.entry
      );
    }
  } finally {
    await bundle?.close();
  }
  return task.taskEntry;
}
