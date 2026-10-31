import type {
  CallExpression,
  ImportDeclaration,
  ImportSpecifier,
  Node,
  Program,
} from "estree";
import MagicString from "magic-string";
import type { Plugin } from "rollup";

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
// Ref: https://github.com/nitrojs/nitro/issues/4759
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
      handler(code, chunk, options) {
        if (!mayNeedRewrites(code)) {
          return;
        }

        let program: Ranged<Program>;
        try {
          // Rollup parses synchronously and returns an AST whose nodes carry
          // `start`/`end` offsets. The ESTree types used here do not model those
          // fields, so the range is added once at this boundary.
          program = this.parse(code) as unknown as Ranged<Program>;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          this.warn(
            `Could not parse \`${chunk.fileName}\` to apply cloudflare output rewrites: ${message}`
          );
          return;
        }

        const edits = collectEdits(program);
        if (edits.length === 0) {
          return;
        }

        const s = new MagicString(code);
        for (const { start, end, content } of edits) {
          if (content === undefined) {
            s.remove(start, end);
          } else {
            s.update(start, end, content);
          }
        }

        return {
          code: s.toString(),
          map: options.sourcemap
            ? s.generateMap({ hires: true, source: chunk.fileName })
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

type Ranged<T extends Node> = T & { start: number; end: number };
type RangedNode = Ranged<Node>;

// `content` is the replacement text, or `undefined` to remove the range
type Edit = { start: number; end: number; content?: string };

function collectEdits(program: Ranged<Program>): Edit[] {
  const edits: Edit[] = [];

  // Minifiers rename the imported binding, so call sites are matched against it
  // rather than against the `createRequire` name alone.
  const createRequireNames = new Set<string>(["createRequire"]);
  for (const node of program.body) {
    if (node.type !== "ImportDeclaration") {
      continue;
    }
    const declaration = node as Ranged<ImportDeclaration>;
    if (
      declaration.specifiers.length === 0 &&
      typeof declaration.source.value === "string" &&
      declaration.source.value.startsWith("node:")
    ) {
      edits.push({ start: declaration.start, end: declaration.end });
      continue;
    }
    for (const specifier of declaration.specifiers) {
      if (
        specifier.type === "ImportSpecifier" &&
        importedName(specifier) === "createRequire"
      ) {
        createRequireNames.add(specifier.local.name);
      }
    }
  }

  walk(program, (node) => {
    if (node.type !== "CallExpression") {
      return;
    }
    const call = node as Ranged<CallExpression>;
    const arg = call.arguments[0] as
      Ranged<CallExpression["arguments"][number]> | undefined;
    if (
      call.callee.type === "Identifier" &&
      createRequireNames.has(call.callee.name) &&
      call.arguments.length === 1 &&
      arg &&
      arg.type !== "SpreadElement" &&
      isImportMetaURL(arg)
    ) {
      edits.push({
        start: arg.start,
        end: arg.end,
        content: CREATE_REQUIRE_GUARD,
      });
    }
  });

  return edits;
}

function importedName(specifier: ImportSpecifier): string {
  return specifier.imported.type === "Identifier"
    ? specifier.imported.name
    : String(specifier.imported.value);
}

function isImportMetaURL(node: Node): boolean {
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

function isNode(value: unknown): value is RangedNode {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const node = value as { type?: unknown; start?: unknown; end?: unknown };
  return (
    typeof node.type === "string" &&
    typeof node.start === "number" &&
    typeof node.end === "number"
  );
}

// Iterative walk so that deeply nested chunks cannot overflow the call stack.
function walk(root: RangedNode, visit: (node: RangedNode) => void): void {
  const stack: RangedNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    visit(node);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (isNode(item)) {
            stack.push(item);
          }
        }
      } else if (isNode(value)) {
        stack.push(value);
      }
    }
  }
}
