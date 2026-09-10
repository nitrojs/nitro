import type { Node, Pattern, Program } from "estree";
import { rolldown } from "rolldown";

export async function extractRouteValidation(code: string, options: { ast: Program }) {
  const { ast } = options;
  const exported = ast.body.find((node) => node.type === "ExportDefaultDeclaration");
  const call = exported?.declaration;
  if (
    call?.type !== "CallExpression" ||
    call.callee.type !== "Identifier" ||
    call.callee.name !== "defineValidatedHandler"
  ) {
    return "export default undefined;";
  }
  const argument = call.arguments[0];
  if (argument?.type !== "ObjectExpression") {
    throw new Error("Request schema inference requires an inline handler options object.");
  }
  const validation = [...argument.properties]
    .reverse()
    .find(
      (property) =>
        property.type === "Property" &&
        !property.computed &&
        (property.key.type === "Identifier"
          ? property.key.name === "validate"
          : property.key.type === "Literal" && property.key.value === "validate")
    );
  if (
    argument.properties.some(
      (property) => property.type === "SpreadElement" || property.computed
    ) ||
    (validation?.type === "Property" && (validation.method || validation.kind !== "init"))
  ) {
    throw new Error("Request schema inference requires a static validate property.");
  }
  if (validation?.type !== "Property") {
    return "export default undefined;";
  }

  const source = (node: Node) => {
    const { start, end } = node as Node & { start: number; end: number };
    return code.slice(start, end);
  };
  const declarations: string[] = [];
  const originals: string[] = [];
  let marker = "__nitro_validation_dependency_";
  while (code.includes(marker)) {
    marker += "_";
  }
  const track = (original: string) => {
    originals.push(original);
    return `/*#__PURE__*/ ${marker}${originals.length - 1}`;
  };
  for (const statement of ast.body) {
    const node = statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
    if (node?.type === "ImportDeclaration") {
      const tail = code.slice(
        (node.source as Node & { end: number }).end,
        (node as Node & { end: number }).end
      );
      for (const specifier of node.specifiers) {
        const binding = source(specifier);
        const original = `import ${specifier.type === "ImportSpecifier" ? `{ ${binding} }` : binding} from ${source(node.source)}${tail}`;
        declarations.push(`const ${specifier.local.name} = ${track(original)}();`);
      }
    } else if (node?.type === "FunctionDeclaration" && node.id) {
      declarations.push(`const ${node.id.name} = ${track(source(node))}(${source(node)});`);
    } else if (node?.type === "VariableDeclaration") {
      for (const declaration of node.declarations) {
        const original = `${node.kind} ${source(declaration)};`;
        const dependency = track(original);
        for (const name of bindingNames(declaration.id)) {
          declarations.push(
            `${node.kind} ${name} = ${dependency}(async () => { ${original} return ${name}; });`
          );
        }
      }
    } else if (node?.type === "ClassDeclaration" && node.id) {
      declarations.push(
        `const ${node.id.name} = ${track(source(node))}(async () => (${source(node)}));`
      );
    }
  }
  declarations.push(`export default async () => (${source(validation.value)});`);

  // Resolve lexical dependencies without loading or evaluating the imported modules.
  const entry = "\0nitro:validation";
  const bundle = await rolldown({
    input: entry,
    external: (id) => id !== entry,
    treeshake: { moduleSideEffects: false, propertyReadSideEffects: false },
    plugins: [
      {
        name: "nitro:validation",
        resolveId: (id) => (id === entry ? entry : undefined),
        load: (id) => (id === entry ? declarations.join("\n") : undefined),
      },
    ],
  });
  try {
    const { output } = await bundle.generate({ format: "es" });
    const retained = new Set(
      [...output[0].code.matchAll(new RegExp(`\\b${marker}(\\d+)\\s*\\(`, "g"))].map((match) =>
        Number(match[1])
      )
    );
    return [
      ...originals.filter((_, index) => retained.has(index)),
      `export default ${source(validation.value)};`,
    ].join("\n");
  } finally {
    await bundle.close();
  }
}

function bindingNames(pattern: Pattern): string[] {
  switch (pattern.type) {
    case "Identifier":
      return [pattern.name];
    case "RestElement":
      return bindingNames(pattern.argument);
    case "AssignmentPattern":
      return bindingNames(pattern.left);
    case "ArrayPattern":
      return pattern.elements.flatMap((element) => (element ? bindingNames(element) : []));
    case "ObjectPattern":
      return pattern.properties.flatMap((property) =>
        bindingNames(property.type === "RestElement" ? property.argument : property.value)
      );
    default:
      return [];
  }
}
