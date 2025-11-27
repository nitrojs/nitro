import type { Plugin } from "rollup";
import { escapeRegExp } from "../../utils/regex.ts";

const PREFIX = "\0virtual:";

export type VirtualModule = {
  id: string;
  template: string | (() => string | Promise<string>);
};

export function virtual(
  input: VirtualModule[],
  opts?: { moduleSideEffects?: boolean }
): Plugin {
  const modules = new Map<
    string,
    { module: VirtualModule; render: () => string | Promise<string> }
  >();
  for (const mod of input) {
    const render = () =>
      typeof mod.template === "function" ? mod.template() : mod.template;
    modules.set(mod.id, { module: mod, render });
  }

  return {
    name: "nitro:virtual",
    api: {
      modules,
    },
    resolveId: {
      order: "pre",
      filter: {
        id: {
          include: new RegExp(
            `^(${[...modules.keys()].map((id) => escapeRegExp(id)).join("|")})$`
          ),
        },
      },
      handler: (id) => {
        return {
          id: PREFIX + id,
          moduleSideEffects: opts?.moduleSideEffects || false,
        };
      },
    },
    load: {
      order: "pre",
      filter: {
        id: new RegExp(`^${escapeRegExp(PREFIX)}`),
      },
      handler: async (id) => {
        const idNoPrefix = id.slice(PREFIX.length);
        const mod = modules.get(idNoPrefix);
        if (!mod) {
          throw new Error(`Virtual module ${idNoPrefix} not found.`);
        }
        return {
          code: await mod.render(),
          map: null,
        };
      },
    },
  };
}
