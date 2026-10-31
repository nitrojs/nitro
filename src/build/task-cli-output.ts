import { resolve } from "pathe";
import { resolveModulePath } from "exsolve";
import { BUILD_EXTENSIONS } from "./_extensions.ts";
import { klona } from "klona";
import { isDeepStrictEqual } from "node:util";

export function taskCLIInputGuard(entry: string) {
  return {
    name: "nitro:task-cli-input",
    options: {
      order: "post" as const,
      handler(options: { input?: unknown }) {
        const input = options.input;
        const entries =
          typeof input === "string"
            ? [input]
            : Array.isArray(input)
              ? input
              : Object.values(input || {});
        if (
          entries.length !== 1 ||
          typeof entries[0] !== "string" ||
          resolvedEntry(entries[0]) !== resolvedEntry(entry)
        ) {
          throw new Error("A build plugin changed the reserved task CLI input contract.");
        }
        return null;
      },
    },
  };
}

export function taskCLIOutputGuard(dir: string, layout: Record<string, unknown>) {
  const { assetFileNames, chunkFileNames, manualChunks, sourcemapFile, sourcemapFileNames } =
    layout;
  const codeSplitting = klona(layout.codeSplitting);
  return {
    name: "nitro:task-cli-output-final",
    outputOptions: {
      order: "post" as const,
      handler(options: {
        dir?: string;
        file?: string;
        format?: string;
        entryFileNames?: unknown;
        inlineDynamicImports?: boolean;
        codeSplitting?: unknown;
        chunkFileNames?: unknown;
        assetFileNames?: unknown;
        sourcemapFile?: unknown;
        sourcemapFileNames?: unknown;
        manualChunks?: unknown;
        preserveModules?: boolean;
        preserveModulesRoot?: string;
      }) {
        if (
          !options.dir ||
          resolve(options.dir) !== resolve(dir) ||
          options.file ||
          !["es", "esm"].includes(options.format || "") ||
          options.entryFileNames !== "index.mjs" ||
          options.inlineDynamicImports ||
          options.codeSplitting === false ||
          options.chunkFileNames !== chunkFileNames ||
          options.assetFileNames !== assetFileNames ||
          options.sourcemapFile !== sourcemapFile ||
          options.sourcemapFileNames !== sourcemapFileNames ||
          options.manualChunks !== manualChunks ||
          options.preserveModules ||
          options.preserveModulesRoot !== undefined ||
          !isDeepStrictEqual(options.codeSplitting, codeSplitting)
        ) {
          throw new Error("A build plugin changed the reserved task CLI output contract.");
        }
        return null;
      },
    },
  };
}

export function assertTaskCLIOutput(
  output: {
    output: { type: string; fileName: string; isEntry?: boolean; facadeModuleId?: string | null }[];
  },
  entry: string
) {
  if (
    !output.output.some(
      (item) =>
        item.type === "chunk" &&
        item.isEntry &&
        item.fileName === "index.mjs" &&
        !!item.facadeModuleId &&
        resolvedEntry(item.facadeModuleId) === resolvedEntry(entry)
    )
  ) {
    throw new Error("The task CLI build did not emit its reserved index.mjs entry.");
  }
}

function resolvedEntry(entry: string) {
  return resolve(resolveModulePath(entry, { extensions: BUILD_EXTENSIONS, try: true }) || entry);
}
