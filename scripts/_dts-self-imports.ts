import MagicString from "magic-string";
import { dirname, relative } from "pathe";
import { parseSync, Visitor } from "rolldown/utils";

/**
 * Rewrites `nitro` and `nitro/*` specifiers (imports, exports, `import()` types and `declare module`)
 * of a declaration file in `dist/` to relative paths, using the `exports` of `package.json`.
 */
export function rewriteSelfImports(
  code: string,
  opts: { file: string; exports: Record<string, string> }
): string {
  const { program, comments, errors } = parseSync(opts.file, code, { lang: "dts" });
  if (errors.length > 0) {
    throw new Error(`Cannot parse \`${opts.file}\`: ${errors[0].message}`);
  }
  const reference = comments.find((c) => /^\/\s*<reference\s+types=["']nitro[/"']/.test(c.value));
  if (reference) {
    throw new Error(`Unexpected \`//${reference.value}\` in \`${opts.file}\``);
  }
  const s = new MagicString(code);
  const rewrite = (node?: { type: string; value?: unknown; start: number; end: number } | null) => {
    if (node?.type !== "Literal" || typeof node.value !== "string") {
      return;
    }
    if (!/^nitro(?:\/|$)/.test(node.value)) {
      return;
    }
    const target = opts.exports[node.value.replace(/^nitro/, ".")];
    if (!target) {
      throw new Error(`Unexpected \`${node.value}\` specifier in \`${opts.file}\``);
    }
    const path = relative(dirname(opts.file), target);
    s.overwrite(node.start, node.end, JSON.stringify(path.startsWith(".") ? path : `./${path}`));
  };
  new Visitor({
    ImportDeclaration: (node) => rewrite(node.source),
    ExportNamedDeclaration: (node) => rewrite(node.source),
    ExportAllDeclaration: (node) => rewrite(node.source),
    TSImportType: (node) => rewrite(node.source),
    TSModuleDeclaration: (node) => rewrite(node.id),
    TSExternalModuleReference: (node) => rewrite(node.expression),
  }).visit(program);
  return s.toString();
}
