import type { BunPlugin } from "./_types.ts";
import { VIRTUAL_NAMESPACE, type PluginContainer } from "./_plugins.ts";
import { cleanId, isFile } from "./_hooks.ts";

/** Bun plugin resolving and loading modules with the Rollup plugins of `container`. */
export function bunPlugin(container: PluginContainer): BunPlugin {
  const { virtualPaths } = container;
  return {
    name: "nitro:plugins",
    setup: (build) => {
      build.onResolve({ filter: /.*/ }, async (args) => {
        const isEntry = args.kind === "entry-point-build";
        const isVirtualImporter = virtualPaths.has(args.importer);
        const importer = isEntry ? undefined : virtualPaths.get(args.importer) || args.importer;
        const resolveOpts = { kind: args.kind, isEntry };
        const resolved =
          (await container.resolveId(args.path, importer || undefined, resolveOpts)) ||
          // Bun resolves imports of virtual modules relative to their id (not a directory)
          (isVirtualImporter
            ? container.defaultResolve(args.path, importer, resolveOpts)
            : undefined) ||
          // Same as Rolldown: queries of files (e.g. `?raw`) are left to `load` hooks
          resolveQuery(container, args.path, importer, resolveOpts);
        if (!resolved) {
          return;
        }
        if (resolved.external) {
          return { path: resolved.id, external: true };
        }
        // Bun rejects file paths containing `..` (e.g. `[...slug].ts`): they are loaded as virtual modules
        if (!resolved.id.includes("..") && isFile(resolved.id)) {
          return { path: resolved.id };
        }
        // Bun writes module paths to the output (comments): `\0` is escaped
        const path = resolved.id.replaceAll("\0", "\\0");
        virtualPaths.set(path, resolved.id);
        return { path, namespace: VIRTUAL_NAMESPACE };
      });
      build.onLoad({ filter: /.*/, namespace: VIRTUAL_NAMESPACE }, async (args) => {
        const id = virtualPaths.get(args.path) || args.path;
        const result = await container.load(id, { read: true });
        if (!result) {
          throw new Error(`Could not load virtual module \`${id}\`.`);
        }
        return result;
      });
      build.onLoad({ filter: /.*/ }, (args) => container.load(args.path, { loader: args.loader }));
    },
  };
}

function resolveQuery(
  container: PluginContainer,
  id: string,
  importer: string | undefined,
  opts: { kind: string }
) {
  const index = id.indexOf("?");
  if (index === -1) {
    return;
  }
  const resolved = container.defaultResolve(cleanId(id), importer, opts);
  return resolved && !resolved.external
    ? { ...resolved, id: resolved.id + id.slice(index) }
    : undefined;
}
