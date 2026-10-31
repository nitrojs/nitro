import type { ViteBuilder } from "vite";
import type { NitroPluginContext } from "./types.ts";
import { createTaskCLIBuild } from "../task-cli.ts";
import { getBundlerConfig } from "./bundler.ts";
import { importVite, viteImportOptions, viteDepPaths } from "./_import.ts";
import { taskCLIPluginReplacements, replaceTaskCLIPlugins } from "../task-cli-plugins.ts";
import { taskCLIInputGuard, assertTaskCLIOutput } from "../task-cli-output.ts";
import { taskCLIOutputOptions } from "../task-cli-output-options.ts";

export async function buildViteTaskCLI(ctx: NitroPluginContext, builder: ViteBuilder) {
  const task = await createTaskCLIBuild(ctx.nitro!);
  if (!task) return;
  task.nitro.options.deps = {
    ...task.nitro.options.deps,
    paths: viteDepPaths(ctx.nitro!),
  };
  const original = ctx.bundlerConfig!;
  const fresh = await getBundlerConfig({ ...ctx, nitro: task.nitro }, original.base.env);
  const replacements = taskCLIPluginReplacements(
    (original.rollupConfig || original.rolldownConfig)!,
    (fresh.rollupConfig || fresh.rolldownConfig)!
  );

  const primary = builder.environments.nitro;
  // Only Nitro-created plugin identities are replaced. In particular Vite's own
  // alias/define plugins and all project transforms retain their environment.
  const plugins = [
    ...(await replaceTaskCLIPlugins(primary.plugins, replacements)),
    taskCLIInputGuard(task.nitro.options.entry),
  ];
  const config = primary.getTopLevelConfig();
  const environmentOptions = {
    ...config.environments.nitro,
    // The resolved environment uses its running Vite version's Rollup/Rolldown hooks.
    plugins: plugins as unknown as import("vite").Plugin[],
    build: {
      ...primary.config.build,
      outDir: task.dir,
      emptyOutDir: false,
      copyPublicDir: false,
      lib: false as const,
      ssr: true,
      watch: null,
      manifest: false,
      ssrManifest: false,
      // Vite 7 and 8 expose different bundler option types, as in env.ts.
      rollupOptions: fresh.rollupConfig
        ? ({
            ...primary.config.build.rollupOptions,
            input: fresh.rollupConfig.input,
            output: taskCLIOutputOptions(
              primary.config.build.rollupOptions.output,
              fresh.rollupConfig.output,
              "rollup",
              task.dir
            ),
          } as any)
        : undefined,
      rolldownOptions: fresh.rolldownConfig
        ? ({
            ...primary.config.build.rolldownOptions,
            input: fresh.rolldownConfig.input,
            output: taskCLIOutputOptions(
              primary.config.build.rolldownOptions.output,
              fresh.rolldownConfig.output,
              "rolldown",
              task.dir
            ),
          } as any)
        : undefined,
    },
  };
  const { BuildEnvironment } = await importVite(viteImportOptions(ctx.nitro!));
  const environment = new BuildEnvironment("nitro", {
    ...config,
    environments: { ...config.environments, nitro: environmentOptions },
  });
  await environment.init();
  const result = await builder.build(environment);
  if (Array.isArray(result)) {
    throw new Error("The task CLI requires one isolated output directory.");
  }
  assertTaskCLIOutput(result as import("rolldown").RolldownOutput, task.nitro.options.entry);
  return task.taskEntry;
}
