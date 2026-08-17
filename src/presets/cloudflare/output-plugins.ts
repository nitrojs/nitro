import type { Plugin } from "rollup";

const CREATE_REQUIRE_RE = /createRequire\(import\.meta\.url\)/g;
const CREATE_REQUIRE_GUARD = 'createRequire(import.meta.url || "file:///")';
const BARE_NODE_IMPORT_RE = /^import\s*['"]node:[^'"]+['"];?\s*$/gm;

type Frame =
  | { kind: "code"; expr: boolean; braces: number }
  | { kind: "sq" | "dq" | "tmpl" | "line" | "block" };

/** 1 = JS code (not a string, template text, or comment). */
function codeContextMask(source: string): Uint8Array {
  const n = source.length;
  const mask = new Uint8Array(n);
  const stack: Frame[] = [{ kind: "code", expr: false, braces: 0 }];
  let i = 0;

  while (i < n) {
    const frame = stack[stack.length - 1]!;
    const c = source[i];
    const next = i + 1 < n ? source[i + 1] : "";

    if (frame.kind === "code") {
      if (c === "/" && next === "/") {
        stack.push({ kind: "line" });
        i += 2;
        continue;
      }
      if (c === "/" && next === "*") {
        stack.push({ kind: "block" });
        i += 2;
        continue;
      }
      if (c === "'") {
        stack.push({ kind: "sq" });
        i++;
        continue;
      }
      if (c === '"') {
        stack.push({ kind: "dq" });
        i++;
        continue;
      }
      if (c === "`") {
        stack.push({ kind: "tmpl" });
        i++;
        continue;
      }
      if (c === "{") {
        frame.braces++;
        mask[i] = 1;
        i++;
        continue;
      }
      if (c === "}") {
        if (frame.expr && frame.braces === 0) {
          stack.pop();
          i++;
          continue;
        }
        if (frame.braces > 0) {
          frame.braces--;
        }
        mask[i] = 1;
        i++;
        continue;
      }
      mask[i] = 1;
      i++;
      continue;
    }

    if (frame.kind === "line") {
      if (c === "\n") {
        stack.pop();
      }
      i++;
      continue;
    }

    if (frame.kind === "block") {
      if (c === "*" && next === "/") {
        stack.pop();
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    if (frame.kind === "sq" || frame.kind === "dq") {
      if (c === "\\") {
        i += 2;
        continue;
      }
      if ((frame.kind === "sq" && c === "'") || (frame.kind === "dq" && c === '"')) {
        stack.pop();
      }
      i++;
      continue;
    }

    // tmpl
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === "`") {
      stack.pop();
      i++;
      continue;
    }
    if (c === "$" && next === "{") {
      stack.push({ kind: "code", expr: true, braces: 0 });
      i += 2;
      continue;
    }
    i++;
  }

  return mask;
}

function replaceInCode(source: string, pattern: RegExp, replacement: string): string {
  const mask = codeContextMask(source);
  const re = new RegExp(pattern.source, pattern.flags);
  return source.replace(re, (match, offset: number) => (mask[offset] ? replacement : match));
}

// Some bundlers (e.g. rolldown-vite) emit `createRequire(import.meta.url)` in
// shared chunks. On Cloudflare Workers `import.meta.url` is `undefined`, which
// causes `createRequire` to throw at runtime. This output plugin rewrites those
// call sites to fall back to a synthetic `file:///` URL so that `createRequire`
// succeeds and any subsequent `require()` calls go through the normal Node.js
// compat layer provided by the Workers runtime.
// Ref: https://github.com/nitrojs/nitro/issues/4132
export function guardCreateRequire(): Plugin {
  return {
    name: "nitro:cloudflare-guard-createRequire",
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === "chunk" && chunk.code?.includes("createRequire(import.meta.url)")) {
          chunk.code = replaceInCode(chunk.code, CREATE_REQUIRE_RE, CREATE_REQUIRE_GUARD);
        }
      }
    },
  };
}

// When code-splitting is enabled, bundlers hoist externalized `node:*` built-in
// imports as bare side-effect imports (`import "node:buffer"`) into entry and
// chunk files. These are no-ops (Node.js built-ins have no meaningful
// module-level side effects) but they can cause issues on worker runtimes where
// `node:*` modules may not be available or trigger unnecessary warnings.
export function stripBareNodeImports(): Plugin {
  return {
    name: "nitro:cloudflare-strip-bare-node-imports",
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === "chunk" && chunk.code.includes("node:")) {
          chunk.code = replaceInCode(chunk.code, BARE_NODE_IMPORT_RE, "");
        }
      }
    },
  };
}
