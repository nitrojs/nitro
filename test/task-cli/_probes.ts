import { parseSync } from "rolldown/utils";
import type { NitroBuildPlugin } from "nitro/types";

type Node = Record<string, any>;

export interface ProbeGraph {
  inputs: string[];
  constructors: number;
}

export function frameworkProbePlugin(graphs: ProbeGraph[]): NitroBuildPlugin {
  let graph: ProbeGraph | undefined;
  return {
    name: "fixture:task-cli-framework-probes",
    enforce: "pre",
    buildStart(options: { input: string | string[] | Record<string, string> }) {
      const inputs =
        typeof options.input === "string"
          ? [options.input]
          : Array.isArray(options.input)
            ? options.input
            : Object.values(options.input || {});
      graph = { inputs, constructors: 0 };
      graphs.push(graph);
    },
    transform(code, id) {
      if (
        !/\/(?:src\/runtime\/internal\/task\.ts|dist\/runtime\/(?:internal|_chunks)\/task\.mjs)$/.test(
          id.split("?")[0]
        )
      ) {
        return;
      }
      const parsed = parseSync(id, code, { sourceType: "module" });
      if (parsed.errors.length) throw new Error("The schedule probe could not parse its module");
      const ast = parsed.program;
      let runner: Node | undefined;
      visit(ast as Node, (node) => {
        if (node.type === "FunctionDeclaration" && node.id?.name === "startScheduleRunner") {
          runner = node;
        }
      });
      if (!runner) {
        return;
      }
      const constructors: Node[] = [];
      visit(runner, (node) => {
        const first = node.arguments?.[0];
        if (
          node.type === "NewExpression" &&
          first?.type === "MemberExpression" &&
          first.object?.name === "schedule" &&
          first.property?.name === "cron"
        ) {
          constructors.push(node.callee);
        }
      });
      if (constructors.length !== 1 || constructors[0].type !== "Identifier") {
        throw new Error("The fixture could not identify the real schedule constructor");
      }
      const { start, end } = constructors[0];
      if (!graph) throw new Error("The schedule probe did not observe buildStart");
      graph.constructors++;
      return {
        code:
          code.slice(0, start) +
          `(globalThis.__taskCLIProbe?.("cron"), ${code.slice(start, end)})` +
          code.slice(end),
        map: null,
      };
    },
  };
}

function visit(node: Node, fn: (node: Node) => void) {
  if (!node || typeof node !== "object") {
    return;
  }
  if (typeof node.type === "string") {
    fn(node);
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const child of value) visit(child, fn);
    } else if (value && typeof value === "object") {
      visit(value, fn);
    }
  }
}
