import type * as ESTree from "oxbox";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import MagicString from "magic-string";
import { dirname, isAbsolute, join } from "pathe";
import type { OXC } from "../../utils/oxc.ts";

/** `export * from` a specifier that is not relative (only those can be external). */
const STAR_EXPORT_RE = /export\s*\*\s*from\s*["'](?!\.\.?\/)/;

const IDENTIFIER_RE = /^[$A-Z_a-z][\w$]*$/;

export interface ExportNames {
  names: string[];
  /** CommonJS modules only have the names Node.js detects statically as named exports. */
  cjs: boolean;
}

/**
 * Rewrites `export * from "<external>"` to named re-exports (or a side effect import).
 *
 * Bun does not import the namespace of an external module re-exported with `export *`
 * (https://github.com/oven-sh/bun/issues/15997). Names are read from the module itself.
 */
export async function rewriteExternalStarExports(
  code: string,
  opts: {
    id: string;
    /** File name of the code (its language). */
    filename: string;
    oxc: OXC;
    /** Module to import for the names, when `specifier` is external. */
    resolveExternal: (specifier: string) => Promise<string | undefined>;
    names: Map<string, Promise<ExportNames>>;
  }
): Promise<string | undefined> {
  if (!STAR_EXPORT_RE.test(code)) {
    return;
  }
  const { program, errors } = opts.oxc.parseSync(opts.filename, code);
  // Syntax errors are reported by Bun
  if (errors.length > 0) {
    return;
  }
  const stars = program.body.filter(
    (node): node is ESTree.ExportAllDeclaration =>
      node.type === "ExportAllDeclaration" &&
      !node.exported &&
      node.exportKind !== "type" &&
      !/^\.\.?\//.test(node.source.value)
  );
  if (stars.length === 0) {
    return;
  }

  const externals = await Promise.all(stars.map((node) => opts.resolveExternal(node.source.value)));
  // Local exports take precedence over star exports
  const exported = new Set(localExportNames(program));
  const s = new MagicString(code);
  for (const [index, node] of stars.entries()) {
    const external = externals[index];
    if (!external) {
      continue;
    }
    const specifier = node.source.value;
    let names = opts.names.get(external);
    if (!names) {
      names = readExportNames(external);
      opts.names.set(external, names);
    }
    const result = await names.catch((error: unknown) => {
      // Retried on the next build (e.g. once the dependency is installed in dev)
      opts.names.delete(external);
      throw new Error(
        `Could not read the exports of \`${specifier}\`, re-exported with \`export *\` by \`${opts.id}\`. Bun does not support \`export *\` from external modules (https://github.com/oven-sh/bun/issues/15997): re-export its names explicitly or use another builder.`,
        { cause: error }
      );
    });
    const reexports = result.names.filter((name) => name !== "default" && !exported.has(name));
    for (const name of reexports) {
      exported.add(name);
    }
    s.overwrite(node.start, node.end, renderReexports(specifier, reexports, { ...result, index }));
  }
  return s.hasChanged() ? s.toString() : undefined;
}

async function readExportNames(external: string): Promise<ExportNames> {
  const mod = await import(isAbsolute(external) ? pathToFileURL(external).href : external);
  return {
    names: Object.keys(mod).filter((name) => name !== "module.exports"),
    cjs: isAbsolute(external) && isCommonJS(external),
  };
}

function renderReexports(
  specifier: string,
  names: string[],
  opts: { cjs: boolean; index: number }
): string {
  const source = JSON.stringify(specifier);
  if (names.length === 0) {
    return `import ${source};`;
  }
  const exportName = (name: string) => (IDENTIFIER_RE.test(name) ? name : JSON.stringify(name));
  if (!opts.cjs) {
    return `export { ${names.map((name) => exportName(name)).join(", ")} } from ${source};`;
  }
  // Read from `module.exports`: Node.js fails to link names its CommonJS lexer does not detect
  const ns = `__nitro_cjs_${opts.index}`;
  const locals = names.map((name, i) => [name, `${ns}_${i}`] as const);
  return [
    `import ${ns} from ${source};`,
    `const { ${locals.map(([name, local]) => `${JSON.stringify(name)}: ${local}`).join(", ")} } = ${ns};`,
    `export { ${locals.map(([name, local]) => `${local} as ${exportName(name)}`).join(", ")} };`,
  ].join(" ");
}

function isCommonJS(path: string): boolean {
  if (/\.c[jt]s$/.test(path)) {
    return true;
  }
  if (!/\.[jt]s$/.test(path)) {
    return false;
  }
  for (let dir = dirname(path); ; dir = dirname(dir)) {
    const pkg = join(dir, "package.json");
    if (existsSync(pkg)) {
      return JSON.parse(readFileSync(pkg, "utf8")).type !== "module";
    }
    if (dirname(dir) === dir) {
      return false;
    }
  }
}

function localExportNames(program: ESTree.Program): string[] {
  const names: string[] = [];
  for (const node of program.body) {
    if (node.type === "ExportDefaultDeclaration") {
      names.push("default");
    } else if (node.type === "ExportAllDeclaration" && node.exported) {
      names.push(moduleExportName(node.exported));
    } else if (node.type === "ExportNamedDeclaration" && node.exportKind !== "type") {
      for (const specifier of node.specifiers) {
        if (specifier.exportKind !== "type") {
          names.push(moduleExportName(specifier.exported));
        }
      }
      const declaration = node.declaration;
      if (!declaration || ("declare" in declaration && declaration.declare)) {
        continue;
      }
      if (declaration.type === "VariableDeclaration") {
        for (const declarator of declaration.declarations) {
          if (declarator.id.type === "Identifier") {
            names.push(declarator.id.name);
          }
        }
      } else if (
        declaration.type !== "TSInterfaceDeclaration" &&
        declaration.type !== "TSTypeAliasDeclaration" &&
        "id" in declaration &&
        declaration.id?.type === "Identifier"
      ) {
        names.push(declaration.id.name);
      }
    }
  }
  return names;
}

function moduleExportName(node: ESTree.ModuleExportName): string {
  return node.type === "Identifier" ? node.name : String(node.value);
}
