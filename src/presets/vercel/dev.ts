import type { Nitro } from "nitro/types";
import { presetsDir } from "nitro/meta";
import { resolveModulePath } from "exsolve";

/**
 * Configure local development emulation for the Vercel preset.
 *
 * When `vercel.queues.triggers` is configured, propagates the trigger list
 * to runtime config and injects a runtime plugin that binds each topic to
 * the `vercel:queue` hook through env-runner's queue dev bridge.
 *
 */
export async function vercelDevModule(nitro: Nitro) {
  if (!nitro.options.dev) {
    return;
  }

  const triggers = nitro.options.vercel?.queues?.triggers;
  if (!triggers?.length) {
    return;
  }

  if (nitro.options.devServer.runner !== "vercel") {
    throw new Error(
      `[vercel:queue] Local queue delivery requires the \`vercel\` dev runner, but \`devServer.runner\` is set to "${nitro.options.devServer.runner}". Remove the \`devServer.runner\` override in your \`nitro.config.ts\` or set it explicitly to \`"vercel"\`.`
    );
  }

  // Propagate triggers to the runtime plugin via runtimeConfig.
  nitro.options.runtimeConfig.vercel = {
    ...nitro.options.runtimeConfig.vercel,
    queues: {
      triggers: triggers.map((t) => ({ ...t })),
    },
  };

  nitro.options.plugins = nitro.options.plugins || [];
  nitro.options.plugins.unshift(
    resolveModulePath("./vercel/runtime/queue.dev", {
      from: presetsDir,
      extensions: [".mjs", ".ts"],
    })
  );
}
