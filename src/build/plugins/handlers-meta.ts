import { readFile } from "node:fs/promises";
import { transform } from "esbuild";
import type { Nitro, NitroEventHandler, NitroRouteMeta } from "nitro/types";
import { extname } from "pathe";
import type { Plugin } from "rollup";
import type {
  CallExpression,
  ExpressionStatement,
  Identifier,
  Node,
} from "estree";
import { traverse, type NodePath } from "estree-toolkit";
import MagicString from "magic-string";
import { createJiti } from "jiti";

// rollups parse method adds the start and end properties
declare module "estree" {
  interface BaseNode {
    start: number;
    end: number;
  }
}

const virtualPrefix = "\0nitro-handler-meta:";

// From esbuild.ts
const esbuildLoaders = {
  ".ts": "ts",
  ".js": "js",
  ".tsx": "tsx",
  ".jsx": "jsx",
} as const;

export function handlersMeta(nitro: Nitro) {
  const jiti = createJiti(nitro.options.rootDir, {
    alias: nitro.options.alias,
    moduleCache: false,
    fsCache: false,
  });

  return {
    name: "nitro:handlers-meta",
    async resolveId(id, importer, resolveOpts) {
      if (id.startsWith("\0")) {
        return;
      }
      if (id.endsWith(`?meta`)) {
        const resolved = await this.resolve(
          id.replace(`?meta`, ``),
          importer,
          resolveOpts
        );
        if (!resolved) {
          return;
        }
        return virtualPrefix + resolved.id;
      }
    },
    load(id) {
      if (id.startsWith(virtualPrefix)) {
        const fullPath = id.slice(virtualPrefix.length);
        return readFile(fullPath, { encoding: "utf8" });
      }
    },
    async transform(code, id) {
      if (!id.startsWith(virtualPrefix)) {
        return;
      }

      let meta: NitroEventHandler["meta"] | null = null;

      try {
        const ext = extname(id) as keyof typeof esbuildLoaders;
        const jsCode = await transform(code, {
          loader: esbuildLoaders[ext],
        }).then((r) => r.code);
        const ast = this.parse(jsCode);

        const nodesToKeep: NodePath[] = [];
        traverse(ast, {
          $: { scope: true },
          ExpressionStatement(path) {
            if (isDefineRouteMeta(path.node! as ExpressionStatement)) {
              nodesToKeep.push(path);
              path.traverse(getIdentityVisitor(nodesToKeep));

              this.stop();
            }
          },
        });

        const routeMetaFile = await generateRouteMetaFile(
          nitro,
          jsCode,
          nodesToKeep
        );

        const { default: routeMeta } = (await jiti.evalModule(routeMetaFile, {
          filename: id.slice(virtualPrefix.length),
        })) as { default: NitroRouteMeta | null };

        meta = routeMeta;
      } catch (error) {
        nitro.logger.warn(
          `[handlers-meta] Cannot extra route meta for: ${id}: ${error}`
        );
      }

      return {
        code: `export default ${JSON.stringify(meta)};`,
        map: null,
      };
    },
  } satisfies Plugin;
}

async function generateRouteMetaFile(
  nitro: Nitro,
  originalCode: string,
  nodes: NodePath[]
): Promise<string> {
  const s = new MagicString(originalCode);

  const orderedNodes = (nodes.map((n) => n.node!) as Node[]).sort(
    (a, b) => a.start - b.start
  );
  const codeParts = orderedNodes.map((node) => {
    if (isDefineRouteMeta(node)) {
      const arg = s.slice(
        node.expression.arguments[0].start,
        node.expression.arguments[0].end
      );
      s.overwrite(node.start, node.end, `export default ${arg}`);
    }

    return s.slice(node.start, node.end);
  });

  const assembledCode = codeParts.join("\n\n");

  if (nitro.unimport)
    return (await nitro.unimport.injectImports(assembledCode)).code;
  else return assembledCode;
}

function getIdentityVisitor<T extends Node>(
  nodesToKeep: NodePath[]
): Parameters<typeof traverse<T, never>>[1] {
  return {
    $: {
      scope: true,
    },
    Identifier(path) {
      if (
        path.node!.name === "defineRouteMeta" || // defineRouteMeta won't have a binding
        isNotReferencePosition(
          path.node as Identifier,
          path.parent as Node | null
        )
      )
        return;

      const binding = path.scope!.getBinding(path.node!.name);
      if (!binding) return;

      const rootParent = binding.path.find((p) => p.parent?.type === "Program");
      if (!rootParent) return;

      if (!nodesToKeep.includes(rootParent)) {
        nodesToKeep.push(rootParent);
        rootParent.traverse(getIdentityVisitor(nodesToKeep));
      }
    },
  };
}

type DefineRouteMetaExpression = ExpressionStatement & {
  expression: CallExpression & {
    callee: {
      type: "Identifier";
      name: "defineRouteMeta";
    };
  };
};

function isDefineRouteMeta(
  node: DefineRouteMetaExpression
): node is DefineRouteMetaExpression;
function isDefineRouteMeta(node: Node): node is DefineRouteMetaExpression;
function isDefineRouteMeta(node: Node): node is DefineRouteMetaExpression {
  return (
    node.type === "ExpressionStatement" &&
    node.expression.type === "CallExpression" &&
    node.expression.callee.type === "Identifier" &&
    node.expression.callee.name === "defineRouteMeta" &&
    node.expression.arguments.length === 1
  );
}

// The functions below are copied from nuxt's definePageMeta code
export function isNotReferencePosition(node: Identifier, parent: Node | null) {
  if (!parent) return false;

  switch (parent.type) {
    case "FunctionDeclaration":
    case "FunctionExpression":
    case "ArrowFunctionExpression": {
      // function name or parameters
      if (parent.type !== "ArrowFunctionExpression" && parent.id === node) {
        return true;
      }
      if (parent.params.length > 0) {
        for (const param of parent.params) {
          const identifiers = getPatternIdentifiers(param);
          if (identifiers.includes(node)) {
            return true;
          }
        }
      }
      return false;
    }

    case "ClassDeclaration":
    case "ClassExpression": {
      // class name
      return parent.id === node;
    }

    case "MethodDefinition": {
      // class method name
      return parent.key === node;
    }

    case "PropertyDefinition": {
      // class property name
      return parent.key === node;
    }

    case "VariableDeclarator": {
      // variable name
      return getPatternIdentifiers(parent.id).includes(node);
    }

    case "CatchClause": {
      // catch clause param
      if (!parent.param) {
        return false;
      }
      return getPatternIdentifiers(parent.param).includes(node);
    }

    case "Property": {
      // property key if not used as a shorthand
      return parent.key === node && parent.value !== node;
    }

    case "MemberExpression": {
      // member expression properties
      return parent.property === node;
    }
  }

  return false;
}

function getPatternIdentifiers(pattern: Node) {
  const identifiers: Identifier[] = [];

  function collectIdentifiers(pattern: Node) {
    switch (pattern.type) {
      case "Identifier": {
        identifiers.push(pattern);
        break;
      }
      case "AssignmentPattern": {
        collectIdentifiers(pattern.left);
        break;
      }
      case "RestElement": {
        collectIdentifiers(pattern.argument);
        break;
      }
      case "ArrayPattern": {
        for (const element of pattern.elements) {
          if (element) {
            collectIdentifiers(
              element.type === "RestElement" ? element.argument : element
            );
          }
        }
        break;
      }
      case "ObjectPattern": {
        for (const property of pattern.properties) {
          collectIdentifiers(
            property.type === "RestElement" ? property.argument : property.value
          );
        }
        break;
      }
    }
  }

  collectIdentifiers(pattern);

  return identifiers;
}
