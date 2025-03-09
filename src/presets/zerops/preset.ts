import { defineNitroPreset } from "../_utils/preset";

const zerops = defineNitroPreset(
  {
    extends: "node-server",
  },
  {
    name: "zerops" as const,
    url: import.meta.url,
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
    url: import.meta.url,
    static: true,
  }
);

export default [zerops, zeropsStatic] as const;
