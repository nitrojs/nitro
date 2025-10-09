import type { NitroOptions } from "nitro/types";

export async function resolveBuilder(options: NitroOptions) {
  if (!options.builder) {
    options.builder = (process.env.NITRO_BUILDER as any) || "rollup";
  }

  if (options.builder === "rolldown") {
    try {
      await import("rolldown");
    } catch {
      throw new Error(
        `Builder "rolldown" is not available. Make sure to install "rolldown" package.`
      );
    }
  } else if (options.builder === "vite") {
    try {
      await import("vite");
    } catch {
      throw new Error(
        `Builder "vite" is not available. Make sure to install "vite" package.`
      );
    }
  }

  if (!["rollup", "rolldown", "vite"].includes(options.builder!)) {
    throw new Error(`Builder "${options.builder}" is not supported.`);
  }
}
