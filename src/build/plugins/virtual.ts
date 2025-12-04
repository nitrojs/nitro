import type { Plugin } from "rollup";
import { escapeRegExp, pathRegExp } from "../../utils/regex.ts";

const PREFIX = "\0nitro:virtual:";

export type VirtualModule = {
  id: string;
  moduleSideEffects?: boolean;
  template: string | (() => string | Promise<string>);
};

export function virtual(input: VirtualModule[]): Plugin {
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
        id: new RegExp(
          `^(${[...modules.keys()].map((id) => pathRegExp(id)).join("|")})$`
        ),
      },
      handler: (id) => {
        const mod = modules.get(id);
        if (!mod) {
          return null;
        }
        return {
          id: PREFIX + id,
          moduleSideEffects: mod.module.moduleSideEffects ?? false,
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
