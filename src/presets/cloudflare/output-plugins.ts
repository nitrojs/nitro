import type { Plugin } from "rollup";
import type { ESTree } from "rolldown/utils";

// Some bundlers (e.g. rolldown-vite) emit `createRequire(import.meta.url)` in
// shared chunks. On Cloudflare Workers `import.meta.url` is `undefined`, which
// causes `createRequire` to throw at runtime. Those call sites are rewritten to
// fall back to a synthetic `file:///` URL so that `createRequire` succeeds and
// any subsequent `require()` calls go through the normal Node.js compat layer
// provided by the Workers runtime.
// Ref: https://github.com/nitrojs/nitro/issues/4132
//
// When code-splitting is enabled, bundlers also hoist externalized `node:*`
// built-in imports as bare side-effect imports (`import "node:buffer"`) into
// entry and chunk files. These are no-ops (Node.js built-ins have no meaningful
// module-level side effects) but they can cause issues on worker runtimes where
// `node:*` modules may not be available or trigger unnecessary warnings.
//
// Both rewrites target syntax, so they run on the parsed chunk rather than on
// its text: chunks also carry module sources as string and template data, and
// replacing inside those corrupts the data they ship.
// Ref: https://github.com/nitrojs/nitro/issues/4526
export function cloudflareOutputRewrites(): Plugin {
  return {
    name: "nitro:cloudflare-output-rewrites",
    renderChunk: {
      // After minification, so that renamed and single-line call sites are covered
      order: "post",
      async handler(code, chunk, options) {
        if (!mayNeedRewrites(code)) {
          return;
        }
        const { parseSync } = await import("rolldown/utils");
        const { program, errors } = parseSync(chunk.fileName, code);
        if (errors.length > 0) {
          this.warn(
            `Could not parse \`${chunk.fileName}\` to apply cloudflare output rewrites: ${errors[0]!.message}`
          );
          return;
        }

        const edits = await collectEdits(program);
        if (edits.length === 0) {
          return;
        }

        const { RolldownMagicString } = await import("rolldown");
        const s = new RolldownMagicString(code);
        for (const { start, end, content } of edits) {
          if (content === undefined) {
            s.remove(start, end);
          } else {
            s.update(start, end, content);
          }
        }

        return {
          code: s.toString(),
          // `generateMap` returns a napi class whose fields are prototype getters, so spreading
          // or serializing it yields `{}`. Both builders accept a JSON source map string.
          map: options.sourcemap
            ? s.generateMap({ hires: true, source: chunk.fileName }).toString()
            : undefined,
        };
      },
    },
  };
}

// Only a chunk that can hold a match is worth parsing: parsing is the whole cost
// of these rewrites, and a typical worker build has a handful of such chunks.
const BARE_NODE_IMPORT_HINT_RE = /import\s*["']node:/;
function mayNeedRewrites(code: string): boolean {
  return (
    BARE_NODE_IMPORT_HINT_RE.test(code) ||
    (code.includes("createRequire") && code.includes("import.meta.url"))
  );
}

const CREATE_REQUIRE_GUARD = 'import.meta.url || "file:///"';

// `content` is the replacement text, or `undefined` to remove the range
type Edit = { start: number; end: number; content?: string };

async function collectEdits(program: ESTree.Program): Promise<Edit[]> {
  const { Visitor } = await import("rolldown/utils");
  const edits: Edit[] = [];

  // Minifiers rename the imported binding, so call sites are matched against it
  // rather than against the `createRequire` name alone.
  const createRequireNames = new Set<string>(["createRequire"]);
  for (const node of program.body) {
    if (node.type !== "ImportDeclaration") {
      continue;
    }
    if (node.specifiers.length === 0 && node.source.value.startsWith("node:")) {
      edits.push({ start: node.start, end: node.end });
      continue;
    }
    for (const specifier of node.specifiers) {
      if (specifier.type === "ImportSpecifier" && importedName(specifier) === "createRequire") {
        createRequireNames.add(specifier.local.name);
      }
    }
  }

  new Visitor({
    CallExpression(node) {
      const arg = node.arguments[0];
      if (
        node.callee.type === "Identifier" &&
        createRequireNames.has(node.callee.name) &&
        node.arguments.length === 1 &&
        arg &&
        isImportMetaURL(arg)
      ) {
        edits.push({ start: arg.start, end: arg.end, content: CREATE_REQUIRE_GUARD });
      }
    },
  }).visit(program);

  return edits;
}

function importedName(specifier: ESTree.ImportSpecifier): string {
  return specifier.imported.type === "Identifier"
    ? specifier.imported.name
    : String(specifier.imported.value);
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
