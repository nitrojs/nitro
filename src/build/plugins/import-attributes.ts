import type { Plugin } from "rollup";
import type { ESTree } from "rolldown/utils";
import { RESOLVED_RE as RAW_RE } from "./raw.ts";

// Bundlers parse the syntax but do not implement the semantics, so imports with a
// `bytes` or `text` type attribute are rewritten to the internal prefixes of the raw plugin.
// https://github.com/tc39/proposal-import-bytes
// https://github.com/tc39/proposal-import-text

const TYPES = ["bytes", "text"] as const;
type ImportType = (typeof TYPES)[number];

const ATTR_RE = /["']?type["']?\s*:\s*["'](bytes|text)["']/;
const JS_ID_RE = /\.[cm]?[jt]sx?(\?.*)?$/;

// A module specifier with a `bytes` or `text` type attribute
type TypedImport = {
  source: ESTree.StringLiteral;
  type: ImportType;
  // End of the syntax trailing the specifier (options argument or attributes clause)
  end: number;
};

export async function importAttributes(): Promise<Plugin> {
  const { RolldownMagicString } = await import("rolldown");
  const { parseSync } = await import("rolldown/utils");

  return {
    name: "nitro:import-attributes",
    transform: {
      order: "pre",
      filter: {
        // Raw modules are file contents rather than source code. Their ids end with a `.js`
        // suffix, so without excluding them, files imported as text would be rewritten too.
        id: { include: JS_ID_RE, exclude: RAW_RE },
        code: ATTR_RE,
      },
      handler(code, id) {
        if (!JS_ID_RE.test(id) || RAW_RE.test(id) || !ATTR_RE.test(code)) {
          return; // In case the builder does not support filters
        }
        const filename = id.split("?")[0]!;
        const { program, errors } = parseSync(filename, code);
        if (errors.length > 0) {
          this.warn(
            `Could not parse \`${filename}\` to transform \`bytes\` and \`text\` import attributes: ${errors[0]!.message}`
          );
          return;
        }

        const imports = findTypedImports(program, code);
        if (imports.length === 0) {
          return;
        }

        const s = new RolldownMagicString(code);
        for (const { source, type, end } of imports) {
          s.update(source.start, source.end, JSON.stringify(`${type}:${source.value}`));
          s.remove(source.end, end);
        }

        return {
          code: s.toString(),
          // `generateMap` returns a napi class whose fields are prototype getters, so spreading
          // or serializing it yields `{}`. Both builders accept a JSON source map string.
          map: s.generateMap({ hires: true, source: filename }).toString(),
        };
      },
    },
  };
}

function findTypedImports(program: ESTree.Program, code: string): TypedImport[] {
  const imports: TypedImport[] = [];
  walk(program, (node) => {
    switch (node.type) {
      // import("./file", { with: { type: "bytes" } })
      case "ImportExpression": {
        const options = node.options;
        if (!isStringLiteral(node.source) || options?.type !== "ObjectExpression") {
          return;
        }
        const type = optionsType(options);
        if (type) {
          imports.push({ source: node.source, type, end: options.end });
        }
        return;
      }
      // import x from "./file" with { type: "bytes" } (also `export ... from`)
      case "ImportDeclaration":
      case "ExportNamedDeclaration":
      case "ExportAllDeclaration": {
        const lastAttr = node.attributes.at(-1);
        const type = attributesType(node.attributes);
        if (!node.source || !lastAttr || !type) {
          return;
        }
        // The `with { ... }` clause has no node of its own: its closing brace is
        // the first `}` following the last attribute.
        imports.push({ source: node.source, type, end: code.indexOf("}", lastAttr.end) + 1 });
      }
    }
  });
  return imports;
}

function attributesType(attributes: ESTree.ImportAttribute[]): ImportType | undefined {
  for (const attr of attributes) {
    const key = attr.key.type === "Identifier" ? attr.key.name : attr.key.value;
    if (key === "type" && isImportType(attr.value.value)) {
      return attr.value.value;
    }
  }
}

function optionsType(options: ESTree.ObjectExpression): ImportType | undefined {
  const withOption = findProperty(options, "with");
  if (withOption?.type !== "ObjectExpression") {
    return;
  }
  const type = findProperty(withOption, "type");
  if (type && isStringLiteral(type) && isImportType(type.value)) {
    return type.value;
  }
}

function findProperty(node: ESTree.ObjectExpression, name: string): ESTree.Expression | undefined {
  for (const prop of node.properties) {
    if (prop.type !== "Property" || prop.computed) {
      continue;
    }
    const key =
      prop.key.type === "Identifier"
        ? prop.key.name
        : isStringLiteral(prop.key)
          ? prop.key.value
          : undefined;
    if (key === name) {
      return prop.value;
    }
  }
}

function isStringLiteral(node: ESTree.Node): node is ESTree.StringLiteral {
  return node.type === "Literal" && typeof (node as ESTree.StringLiteral).value === "string";
}

function isImportType(value: string): value is ImportType {
  return TYPES.includes(value as ImportType);
}

function walk(node: unknown, visit: (node: ESTree.Node) => void): void {
  if (Array.isArray(node)) {
    for (const child of node) {
      walk(child, visit);
    }
    return;
  }
  if (!node || typeof node !== "object") {
    return;
  }
  const record = node as Record<string, unknown>;
  if (typeof record.type === "string") {
    visit(node as ESTree.Node);
  }
  for (const key in record) {
    if (key !== "parent") {
      walk(record[key], visit);
    }
  }
}
