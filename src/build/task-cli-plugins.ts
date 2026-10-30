import type { Plugin } from "rollup";
import type { BuildEnv } from "./env.ts";

const buildSnapshots = new WeakMap<object, { roles: Map<string, Plugin>; env: BuildEnv }>();

/** Capture only the plugins created by Nitro, before project config hooks run. */
export function rememberTaskCLIPlugins(
  config: object,
  plugins: (Plugin | false | undefined)[],
  env: BuildEnv
) {
  const roles = new Map<string, Plugin>();
  for (const plugin of plugins.filter(Boolean) as Plugin[]) {
    if (roles.has(plugin.name)) {
      throw new Error(`Duplicate internal build plugin role: ${plugin.name}`);
    }
    roles.set(plugin.name, plugin);
  }
  buildSnapshots.set(config, { roles, env });
}

export function taskCLIBuildEnv(config: object): BuildEnv {
  const snapshot = buildSnapshots.get(config);
  if (!snapshot) throw new Error("Missing task CLI build environment snapshot.");
  return snapshot.env;
}

export function taskCLIPluginReplacements(primary: object, sidecar: object) {
  const original = buildSnapshots.get(primary)?.roles;
  const fresh = buildSnapshots.get(sidecar)?.roles;
  if (!original || !fresh) throw new Error("Missing task CLI build plugin snapshot.");
  const replacements = new Map<Plugin, Plugin>();
  for (const [role, plugin] of original) {
    const replacement = fresh.get(role);
    if (!replacement) throw new Error(`Cannot isolate the task CLI build plugin: ${role}`);
    replacements.set(plugin, replacement);
  }
  return replacements;
}

export async function replaceTaskCLIPlugins(input: unknown, replacements: Map<Plugin, Plugin>) {
  const plugins = await flattenPlugins(input);
  // Identity matching preserves hook-added transforms and unrelated plugins with the same name.
  for (const plugin of replacements.keys()) {
    if (!plugins.includes(plugin)) {
      throw new Error(`Cannot isolate a replaced or wrapped Nitro build plugin: ${plugin.name}`);
    }
  }
  return plugins.map((plugin) => replacements.get(plugin) || plugin);
}

async function flattenPlugins(input: unknown): Promise<Plugin[]> {
  const value = await input;
  if (!value) return [];
  if (Array.isArray(value)) {
    return (await Promise.all(value.map(flattenPlugins))).flat();
  }
  return [value as Plugin];
}
