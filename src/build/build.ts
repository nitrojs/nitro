import type { Nitro } from "nitro/types";
import { existsSync } from "node:fs";
import { compressPublicAssets } from "../utils/compress.ts";

export async function build(nitro: Nitro) {
  if (!nitro.options.dev && nitro.options.compressPublicAssets) {
    nitro.hooks.hookOnce("close", async () => {
      if (existsSync(nitro.options.output.publicDir)) {
        await compressPublicAssets(nitro);
      }
    });
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
    case "rspack": {
      const { rspackBuild } = await import("./rspack/build.ts");
      return rspackBuild(nitro);
    }
    case "vite": {
      const { viteBuild } = await import("./vite/build.ts");
      return viteBuild(nitro);
    }
    case false: {
      const { unbundledBuild } = await import("./unbundled/build.ts");
      return unbundledBuild(nitro);
    }
    default: {
      throw new Error(`Unknown builder: ${nitro.options.builder}`);
    }
  }
}
