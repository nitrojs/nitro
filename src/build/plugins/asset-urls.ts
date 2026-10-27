import type { Nitro } from "nitro/types";
import type { Plugin } from "rollup";
import type * as ESTree from "oxbox";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { basename } from "pathe";
import MagicString from "magic-string";
import { importOXC, walkAST } from "../../utils/oxc.ts";
import { RESOLVED_RE as RAW_RE } from "./raw.ts";

// Packages built with emscripten or wasm-bindgen locate their runtime files relative to their
// own module (`new URL("./file.wasm", import.meta.url)`). Once bundled, these URLs point next to
// the output chunk, so the referenced files are emitted as assets and the URLs rewritten to them.
// https://github.com/nitrojs/nitro/issues/4930

// Evaluated by the bundler before calling into JS, so only modules holding a reference are parsed
const NEW_URL_RE = /\bnew\s+URL\s*\([\s\S]*?import\.meta\.url\b/;

// Only JavaScript modules are parsed (with Vite, the hook also sees `.vue`, `.json`, ... sources)
const JS_ID_RE = /\.[cm]?[jt]sx?(\?.*)?$/;

// Scripts are copied as-is by asset emission (not bundled), which would break their imports
const SCRIPT_RE = /\.[cm]?[jt]sx?$/;

// Specifiers with a scheme (`data:`, `https:`, ...), absolute paths and bare queries or hashes
const NON_RELATIVE_RE = /^(?:[a-z][\d+.a-z-]*:|[#/?\\])/i;

export async function assetUrls(
  nitro: Nitro,
  opts: {
    /** Remove the other assets of the bundle (Vite emits CSS, `?url` imports, ... of server code) */
    dropOtherAssets?: boolean;
  } = {}
): Promise<Plugin> {
  const oxc = await importOXC({ dir: nitro.options.rootDir, paths: nitro.options.deps?.paths });

  // `pglite` references its 10 MB wasm file several times: read and emit each file once per build
  let referenceIds = new Map<string, string>();
  // Kept across rebuilds: watch mode re-emits the files of cached modules without transforming them
  const emitted = new Set<string>();
  // Output files of the references that are rendered
  const fileNames = new Set<string>();

  return {
    name: "nitro:asset-urls",
    buildStart() {
      referenceIds = new Map();
    },
    renderStart() {
      fileNames.clear();
    },
    // The reference is the first argument of `new URL`, so a relative path is enough.
    // Runs before Vite's own hook, which renders an absolute URL under its `base`.
    resolveFileUrl: {
      order: "pre",
      handler({ referenceId, fileName, relativePath }) {
        if (emitted.has(referenceId)) {
          fileNames.add(fileName);
          return JSON.stringify(/^\.\.?\//.test(relativePath) ? relativePath : `./${relativePath}`);
        }
      },
    },
    generateBundle: opts.dropOtherAssets
      ? {
          order: "post",
          handler(_options, bundle) {
            // Same exceptions as Vite, when `build.emitAssets` is disabled
            for (const [fileName, output] of Object.entries(bundle)) {
              if (
                output.type === "asset" &&
                !fileNames.has(fileName) &&
                !fileName.endsWith(".map") &&
                !fileName.endsWith("ssr-manifest.json")
              ) {
                delete bundle[fileName];
              }
            }
          },
        }
      : undefined,
    transform: {
      filter: {
        id: { include: JS_ID_RE, exclude: [/^\0/, RAW_RE] },
        code: NEW_URL_RE,
      },
      handler(code, id) {
        if (
          !JS_ID_RE.test(id) ||
          id.startsWith("\0") ||
          RAW_RE.test(id) ||
          !NEW_URL_RE.test(code)
        ) {
          return; // In case the builder does not support filters
        }
        const filename = id.split("?")[0]!;
        const { program, errors } = oxc.parseSync(filename, code);
        if (errors.length > 0) {
          this.warn(
            `Could not parse \`${filename}\` to emit files referenced with \`new URL(..., import.meta.url)\`: ${errors[0]!.message}`
          );
          return;
        }

        const s = new MagicString(code);
        walkAST<ESTree.Node>(program, (node) => {
          const ref = assetReference(node);
          const path = ref && resolveAssetPath(ref.url, filename);
          if (!ref || !path) {
            return;
          }
          let referenceId = referenceIds.get(path);
          if (!referenceId) {
            referenceId = this.emitFile({
              type: "asset",
              name: basename(path),
              originalFileName: path,
              source: readFileSync(path),
            });
            referenceIds.set(path, referenceId);
            emitted.add(referenceId);
          }
          this.addWatchFile(path);
          // `import.meta.url` is kept as the base, so the expression still yields a `URL`
          s.update(ref.node.start, ref.node.end, `import.meta.ROLLUP_FILE_URL_${referenceId}`);
        });

        if (!s.hasChanged()) {
          return;
        }
        return {
          code: s.toString(),
          map: s.generateMap({ hires: true, source: filename }).toString(),
        };
      },
    },
  };
}

// new URL("./file", import.meta.url)
function assetReference(node: ESTree.Node): { node: ESTree.Node; url: string } | undefined {
  if (
    node.type !== "NewExpression" ||
    node.callee.type !== "Identifier" ||
    node.callee.name !== "URL" ||
    node.arguments.length !== 2 ||
    !isImportMetaURL(node.arguments[1]!)
  ) {
    return;
  }
  const arg = node.arguments[0]!;
  if (arg.type === "Literal" && typeof arg.value === "string") {
    return { node: arg, url: arg.value };
  }
  if (arg.type === "TemplateLiteral" && arg.expressions.length === 0) {
    const url = arg.quasis[0]?.value.cooked;
    return url ? { node: arg, url } : undefined;
  }
}

function resolveAssetPath(url: string, importer: string): string | undefined {
  if (!url || NON_RELATIVE_RE.test(url)) {
    return;
  }
  const resolved = new URL(url, pathToFileURL(importer));
  if (resolved.search || resolved.hash) {
    return;
  }
  const path = fileURLToPath(resolved);
  // Missing files are left to fail (or be provided) at runtime, as without bundling
  if (SCRIPT_RE.test(path) || !statSync(path, { throwIfNoEntry: false })?.isFile()) {
    return;
  }
  return path;
}

function isImportMetaURL(node: ESTree.Node): boolean {
  return (
    node.type === "MemberExpression" &&
    !node.computed &&
    node.object.type === "MetaProperty" &&
    node.object.meta.name === "import" &&
    node.object.property.name === "meta" &&
    node.property.type === "Identifier" &&
    node.property.name === "url"
  );
}
