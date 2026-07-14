import { RolldownMagicString } from "rolldown";
import { parseSync } from "rolldown/utils";
import type { Plugin } from "rollup";

// Bundlers parse the syntax but do not implement the semantics, so imports with a
// `bytes` or `text` type attribute are rewritten to the internal prefixes of the raw plugin.
// https://github.com/tc39/proposal-import-bytes
// https://github.com/tc39/proposal-import-text

const TYPES = new Set(["bytes", "text"]);
const ATTR_RE = /["']?type["']?\s*:\s*["'](bytes|text)["']/;
const JS_ID_RE = /\.[cm]?[jt]sx?(\?.*)?$/;

export function importAttributes(): Plugin {
  return {
    name: "nitro:import-attributes",
    transform: {
      order: "pre",
      filter: {
        id: JS_ID_RE,
        code: ATTR_RE,
      },
      handler(code, id) {
        if (!ATTR_RE.test(code)) {
          return; // In case the builder does not support code filters
        }
        const filename = id.split("?")[0]!;
        const { program, errors } = parseSync(filename, code);
        if (errors.length > 0) {
          return; // Let the bundler report syntax errors
        }

        const s = new RolldownMagicString(code);
        let modified = false;

        for (const { node, type } of findTypedImports(program)) {
          const { source } = node;
          s.update(source.start, source.end, JSON.stringify(`${type}:${source.value}`));
          if (node.type === "ImportExpression") {
            // Drop the `, { with: { type: "..." } }` options argument
            s.remove(source.end, code.lastIndexOf(")", node.end - 1));
          } else {
            // Drop the `with { type: "..." }` attributes clause
            const lastAttr = node.attributes.at(-1);
            s.remove(source.end, code.indexOf("}", lastAttr.end) + 1);
          }
          modified = true;
        }

        if (!modified) {
          return;
        }

        const map = s.generateMap({ hires: true, includeContent: false, source: filename });
        return {
          code: s.toString(),
          map: {
            version: 3,
            file: filename,
            sources: [...map.sources],
            sourcesContent: [],
            names: [...map.names],
            mappings: map.mappings,
          },
        };
      },
    },
  };
}

function findTypedImports(program: any): { node: any; type: string }[] {
  const imports: { node: any; type: string }[] = [];
  walk(program, (node) => {
    if (node.source?.type !== "Literal" || typeof node.source.value !== "string") {
      return;
    }
    const type =
      // import x from "./file" with { type: "bytes" } (also `export ... from`)
      importType(node.attributes) ||
      // import("./file", { with: { type: "bytes" } })
      (node.type === "ImportExpression"
        ? importType(findProperty(node.options, "with")?.properties)
        : undefined);
    if (type) {
      imports.push({ node, type });
    }
  });
  return imports;
}

function importType(attributes: any): string | undefined {
  for (const attr of attributes || []) {
    if (propertyName(attr) === "type" && TYPES.has(attr.value?.value)) {
      return attr.value.value;
    }
  }
}

function findProperty(node: any, name: string): any {
  if (node?.type !== "ObjectExpression") {
    return;
  }
  return node.properties.find((prop: any) => propertyName(prop) === name)?.value;
}

function propertyName(node: any): string | undefined {
  const key = node?.key;
  return key?.type === "Identifier" ? key.name : key?.value;
}

function walk(node: any, visit: (node: any) => void): void {
  if (Array.isArray(node)) {
    for (const child of node) {
      walk(child, visit);
    }
    return;
  }
  if (!node || typeof node !== "object") {
    return;
  }
  if (typeof node.type === "string") {
    visit(node);
  }
  for (const key in node) {
    walk(node[key], visit);
  }
}
