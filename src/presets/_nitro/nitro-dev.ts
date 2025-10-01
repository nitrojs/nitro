import { runtimeDir } from "nitro/runtime/meta";
import { defineNitroPreset } from "../_utils/preset";
import { join } from "pathe";

const nitroDev = defineNitroPreset(
  {
    entry: "./runtime/nitro-dev",
    output: {
      dir: "{{ buildDir }}/dev",
      serverDir: "{{ buildDir }}/dev",
      publicDir: "{{ buildDir }}/dev",
    },
    handlers: [
      {
        route: "/_nitro/tasks/**",
        handler: join(runtimeDir, "internal/routes/dev-tasks"),
      },
    ],
    externals: { trace: false },
    serveStatic: true,
    inlineDynamicImports: true, // externals plugin limitation
    sourceMap: true,
  },
  {
    name: "nitro-dev" as const,
    dev: true,
    url: import.meta.url,
  }
);

export default [nitroDev] as const;
