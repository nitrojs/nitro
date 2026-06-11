import { fileURLToPath } from "node:url";
import { resolveModulePath } from "exsolve";
import type { Nitro } from "nitropack/types";

/**
 * Configure local development emulation for the Vercel preset.
 *
 * When `vercel.queues.triggers` is configured, propagates the trigger list to
 * runtime config and injects a runtime plugin that binds each topic to the
 * `vercel:queue` hook through `@vercel/queue`'s local dev consumer registry.
 */
export async function vercelDev(nitro: Nitro) {
  if (!nitro.options.dev) {
    return; // Production doesn't need this
  }

  const triggers = nitro.options.vercel?.queues?.triggers;
  if (!triggers?.length) {
    return;
  }

  // `@vercel/queue` is an optional peer dependency. Without it, local queue
  // delivery is simply disabled (dev startup is never blocked).
  const resolved = resolveModulePath("@vercel/queue", {
    from: nitro.options.nodeModulesDirs,
    try: true,
  });
  if (!resolved) {
    nitro.logger.warn(
      "`@vercel/queue` is not installed. Local queue delivery is disabled. Install it with `npx nypm i @vercel/queue` to enable it."
    );
    return;
  }

  // Propagate triggers to the runtime plugin via runtimeConfig.
  nitro.options.runtimeConfig.vercel = {
    ...nitro.options.runtimeConfig.vercel,
    queues: {
      triggers: triggers.map((t) => ({ ...t })),
    },
  };

  // Make sure the runtime plugin is transpiled.
  nitro.options.externals.inline = nitro.options.externals.inline || [];
  nitro.options.externals.inline.push(
    fileURLToPath(new URL("runtime/", import.meta.url))
  );

  // Inject the dev consumer plugin.
  nitro.options.plugins = nitro.options.plugins || [];
  nitro.options.plugins.unshift(
    fileURLToPath(new URL("runtime/queue.dev", import.meta.url))
  );
}
