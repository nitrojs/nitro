import type { Plugin } from "rollup";
import { pathRegExp } from "../../utils/regex.ts";

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

  const include: RegExp[] = [/^#nitro\/virtual/];

  const extraIds = [...modules.keys()].filter(
    (key) => !key.startsWith("#nitro/virtual")
  );
  if (extraIds.length > 0) {
    include.push(
      new RegExp(`^(${extraIds.map((id) => pathRegExp(id)).join("|")})$`)
    );
  }

  return {
    name: "nitro:virtual",
    api: {
      modules,
    },
    resolveId: {
      order: "pre",
      filter: { id: include },
      handler: (id) => {
        const mod = modules.get(id);
        if (mod) {
          return {
            id,
            moduleSideEffects: mod.module.moduleSideEffects ?? false,
          };
        }
      },
    },
    load: {
      order: "pre",
      filter: { id: include },
      handler: async (id) => {
        const mod = modules.get(id);
        if (!mod) {
          throw new Error(`Virtual module ${id} not found.`);
        }
        return {
          code: await mod.render(),
          map: null,
        };
      },
    },
  };
}
