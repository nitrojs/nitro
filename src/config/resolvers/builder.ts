import type { NitroOptions } from "nitro/types";

export async function resolveBuilder(options: NitroOptions) {
  if (!options.builder) {
    options.builder = (process.env.NITRO_BUILDER as any) || "rollup";
  }

  switch (options.builder) {
    case "rollup": {
      try {
        await import("rollup");
      } catch {
        throw new Error(
          `Builder "rollup" is not available. Make sure to install "rollup" package.`
        );
      }

      break;
    }
    case "rolldown": {
      try {
        await import("rolldown");
      } catch {
        throw new Error(
          `Builder "rolldown" is not available. Make sure to install "rolldown" package.`
        );
      }

      break;
    }
    case "vite":
    case "rolldown-vite": {
      try {
        await import("vite");
      } catch {
        throw new Error(
          `Builder "vite" is not available. Make sure to install "vite" package.`
        );
      }

      break;
    }
    default: {
      throw new Error(`Builder "${options.builder}" is not supported.`);
    }
  }
}
