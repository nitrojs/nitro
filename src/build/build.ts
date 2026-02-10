import type { Nitro } from "nitro/types";

export async function build(nitro: Nitro) {
  if (nitro.options.builderless && nitro.options.builder === "vite") {
    throw new Error("`builderless` is currently supported only with `rollup` and `rolldown`.");
  }

  switch (nitro.options.builder) {
    case "rollup": {
      const { rollupBuild } = await import("./rollup/build.ts");
      return rollupBuild(nitro);
    }
    case "rolldown": {
      const { rolldownBuild } = await import("./rolldown/build.ts");
      return rolldownBuild(nitro);
    }
    case "vite": {
      const { viteBuild } = await import("./vite/build.ts");
      return viteBuild(nitro);
    }
    default: {
      throw new Error(`Unknown builder: ${nitro.options.builder}`);
    }
  }
}
