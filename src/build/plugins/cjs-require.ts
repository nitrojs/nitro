import { dirname, relative } from "pathe";
import type { Nitro } from "nitro/types";
import type { OutputChunk, Plugin } from "rollup";

// Some dependencies vendor their own pre-bundled CommonJS (e.g.
// `use-sync-external-store`'s shim shipped inside base-ui / recharts / reactflow).
// When such code does `require("react")` and React is an SSR-external, Vite's SSR
// build lowers it to a runtime `__require("react")` (createRequire). Once a
// downstream bundler (Nitro, for a self-contained `.output/`) bundles React, that
// runtime require is left dangling — it either fails (`Cannot find module 'react'`)
// or loads a *second* React instance with a null dispatcher ("Invalid hook call").
// See nitrojs/nitro#4171.
//
// This plugin rewrites such leaked `__require("x")` calls to the copy of `x` already
// bundled in the output, so a single instance is used and the output stays
// self-contained.

// Maps a specifier to the CJS initializer variable Rolldown generates for it.
// Used in "react" (targeted) mode and as reliable hints in "all" mode.
const KNOWN_INITIALIZERS: Record<string, string> = {
  react: "require_react",
  "react-dom": "require_react_dom",
  "react/jsx-runtime": "require_jsx_runtime",
  "react/jsx-dev-runtime": "require_jsx_dev_runtime",
  scheduler: "require_scheduler",
};

const LEAK_RE = /\b__require\(\s*"([^"]+)"\s*\)/g;
const DEF_RE = /\bvar (require_[A-Za-z0-9_$]+)\s*=[^\n]*__commonJS/g;

export type CjsRequireMode = "react" | "all";

export function cjsRequire(nitro: Nitro, mode: CjsRequireMode = "react"): Plugin {
  return {
    name: "nitro:cjs-require",
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).filter(
        (asset): asset is OutputChunk => asset.type === "chunk"
      );

      // Bare specifiers that leaked as a runtime `__require(...)`.
      const leaked = new Set<string>();
      for (const chunk of chunks) {
        for (const [, spec] of chunk.code.matchAll(LEAK_RE)) {
          leaked.add(spec);
        }
      }
      if (leaked.size === 0) {
        return;
      }

      // Index of CJS initializers defined across the output (`require_x` -> chunk).
      const defIndex = new Map<string, OutputChunk>();
      for (const chunk of chunks) {
        for (const [, name] of chunk.code.matchAll(DEF_RE)) {
          if (!defIndex.has(name)) {
            defIndex.set(name, chunk);
          }
        }
      }

      const unresolved: string[] = [];
      for (const spec of leaked) {
        // A leaked require for a genuinely external dependency is expected — only act
        // on specifiers whose package is actually bundled in the output.
        if (!isBundled(chunks, spec)) {
          continue;
        }

        const initVar = resolveInitVar(spec, mode, defIndex);
        if (!initVar) {
          unresolved.push(spec);
          continue;
        }
        const provider = defIndex.get(initVar)!;

        // Ensure the initializer is exported from its chunk (Rolldown may have left
        // it defined-but-unexported if nothing imported it).
        let alias = findExportAlias(provider.code, initVar);
        if (!alias) {
          alias = `__nitro_${initVar}`;
          provider.code += `\nexport { ${initVar} as ${alias} };\n`;
        }

        const requireRe = new RegExp(`__require\\(\\s*"${escapeRe(spec)}"\\s*\\)`, "g");
        for (const chunk of chunks) {
          if (!requireRe.test(chunk.code)) {
            continue;
          }
          requireRe.lastIndex = 0;
          if (chunk === provider) {
            // The initializer is already in scope.
            chunk.code = chunk.code.replace(requireRe, `${initVar}()`);
            continue;
          }
          const local = `__nitroCjs_${spec.replace(/[^A-Za-z0-9_$]/g, "_")}`;
          const rel = toImportPath(chunk.fileName, provider.fileName);
          chunk.code = chunk.code.replace(requireRe, `${local}()`);
          chunk.code = prependImport(chunk.code, `import { ${alias} as ${local} } from "${rel}";`);
        }
      }

      if (unresolved.length > 0) {
        nitro.logger.warn(
          `Some bundled dependencies leaked a runtime \`require()\` in the server output and could not be rewritten to their bundled copy: ${[
            ...new Set(unresolved),
          ]
            .map((s) => `\`${s}\``)
            .join(
              ", "
            )}.\nThis can fail at runtime when \`node_modules\` is not shipped (e.g. Docker). See https://github.com/nitrojs/nitro/issues/4171`
        );
      }
    },
  } satisfies Plugin;
}

/** Resolve the bundled CJS initializer variable for a leaked specifier. */
function resolveInitVar(
  spec: string,
  mode: CjsRequireMode,
  defIndex: Map<string, OutputChunk>
): string | undefined {
  const known = KNOWN_INITIALIZERS[spec];
  if (known) {
    return defIndex.has(known) ? known : undefined;
  }
  if (mode !== "all") {
    return undefined;
  }
  // Generic resolution: derive likely initializer names from the specifier and keep
  // the one defined in a chunk that actually bundles the package.
  for (const candidate of candidateInitNames(spec)) {
    const chunk = defIndex.get(candidate);
    if (chunk && bundlesPkg(chunk, pkgOf(spec))) {
      return candidate;
    }
  }
  return undefined;
}

function candidateInitNames(spec: string): string[] {
  const sanitize = (s: string) => s.replace(/[^A-Za-z0-9_$]/g, "_");
  const last = spec.split("/").pop()!;
  const pkg = pkgOf(spec);
  const pkgBase = pkg.startsWith("@") ? pkg.split("/")[1] : pkg;
  return [...new Set([`require_${sanitize(last)}`, `require_${sanitize(pkgBase)}`])];
}

function pkgOf(spec: string): string {
  return spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
}

/** Whether the package behind a (sub-path) specifier is bundled in any chunk. */
function isBundled(chunks: OutputChunk[], spec: string): boolean {
  return chunks.some((c) => bundlesPkg(c, pkgOf(spec)));
}

function bundlesPkg(chunk: OutputChunk, pkg: string): boolean {
  const re = new RegExp(`[/\\\\]node_modules[/\\\\]${escapeRe(pkg)}[/\\\\]`);
  return Object.keys(chunk.modules).some((id) => re.test(id));
}

function findExportAlias(code: string, local: string): string | undefined {
  for (const [, body] of code.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const entry of body.split(",")) {
      const m = entry.trim().match(/^(\S+)(?:\s+as\s+(\S+))?$/);
      if (m && m[1] === local) {
        return m[2] || m[1];
      }
    }
  }
  return undefined;
}

function toImportPath(from: string, to: string): string {
  let rel = relative(dirname(from), to);
  if (!rel.startsWith(".")) {
    rel = `./${rel}`;
  }
  return rel;
}

function prependImport(code: string, importStmt: string): string {
  // Keep imports after a leading shebang if present.
  if (code.startsWith("#!")) {
    const nl = code.indexOf("\n") + 1;
    return code.slice(0, nl) + importStmt + "\n" + code.slice(nl);
  }
  return `${importStmt}\n${code}`;
}

function escapeRe(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
