import { defineNitroPreset } from "../_utils/preset";

const zerops = defineNitroPreset(
  {
    extends: "node-server",
    serveStatic: true,
  },
  {
    name: "zerops" as const,
  }
);

const zeropsStatic = defineNitroPreset(
  {
    extends: "static",
    output: {
      dir: "{{ rootDir }}/.zerops/output",
      publicDir: "{{ output.dir }}/static",
    },
  },
  {
    name: "zerops-static" as const,

    static: true,
  }
);

export default [zerops, zeropsStatic] as const;
