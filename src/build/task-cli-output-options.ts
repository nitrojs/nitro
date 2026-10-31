import { taskCLIOutputGuard } from "./task-cli-output.ts";

const shared = new Set([
  "plugins",
  "banner",
  "footer",
  "intro",
  "outro",
  "sourcemap",
  "sourcemapBaseUrl",
  "sourcemapDebugIds",
  "sourcemapExcludeSources",
  "sourcemapIgnoreList",
  "sourcemapPathTransform",
  "generatedCode",
  "minifyInternalExports",
  "externalLiveBindings",
  "strict",
]);
const perBuilder = {
  rollup: new Set([
    "compact",
    "indent",
    "freeze",
    "interop",
    "reexportProtoFromExternal",
    "externalImportAssertions",
    "externalImportAttributes",
    "importAttributesKey",
    "validate",
  ]),
  rolldown: new Set([
    "postBanner",
    "postFooter",
    "minify",
    "charset",
    "legalComments",
    "comments",
    "keepNames",
    "topLevelVar",
    "strictExecutionOrder",
    "polyfillRequire",
  ]),
};
// The sidecar has its own destination and chunk graph, including map filenames.
const layout = new Set([
  "dir",
  "file",
  "format",
  "entryFileNames",
  "chunkFileNames",
  "assetFileNames",
  "inlineDynamicImports",
  "manualChunks",
  "codeSplitting",
  "advancedChunks",
  "preserveModules",
  "preserveModulesRoot",
  "onlyExplicitManualChunks",
  "experimentalMinChunkSize",
  "hoistTransitiveImports",
  "virtualDirname",
  "sanitizeFileName",
  "hashCharacters",
  "cleanDir",
  "sourcemapFile",
  "sourcemapFileNames",
]);
const formatDefaults: Record<string, unknown> = {
  amd: {},
  globals: {},
  name: "",
  noConflict: false,
  extend: false,
  esModule: "if-default-prop",
  exports: "auto",
  dynamicImportInCjs: true,
  systemNullSetters: true,
};

/** Preserve output-only transforms without inheriting the primary output layout. */
export function taskCLIOutputOptions(
  primary: unknown,
  fresh: unknown,
  builder: "rollup" | "rolldown",
  dir: string
) {
  if (Array.isArray(primary)) {
    throw new Error("`experimental.taskCLI` requires a single primary output configuration.");
  }
  const original = (primary || {}) as Record<string, unknown>;
  const output = { ...(fresh as Record<string, unknown>) };
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined || layout.has(key)) continue;
    if (shared.has(key) || perBuilder[builder].has(key)) {
      output[key] = value;
      continue;
    }
    if (key === "paths" && isEmptyRecord(value)) continue;
    if (Object.hasOwn(formatDefaults, key) && isDefault(value, formatDefaults[key])) continue;
    throw new Error(
      `\`experimental.taskCLI\` cannot preserve output option ${JSON.stringify(key)} with ${builder}; use a supported output transform or disable the task CLI.`
    );
  }
  // Output plugins run after input plugins. A separate final output-only guard
  // must follow even post hooks, without promoting output transforms to input hooks.
  output.plugins = [original.plugins, taskCLIOutputGuard(dir, output)];
  return output;
}

function isEmptyRecord(value: unknown) {
  return (
    !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0
  );
}

function isDefault(value: unknown, fallback: unknown) {
  return value === fallback || (isEmptyRecord(value) && isEmptyRecord(fallback));
}
