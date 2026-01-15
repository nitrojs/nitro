import { defineNitroPreset } from "../_utils/preset.ts";

const zeabur = defineNitroPreset(
  {
    extends: "node-server",
  },
  {
    name: "zeabur" as const,
    stdName: "zeabur",
  }
);

const zeaburStatic = defineNitroPreset(
  {
    extends: "static",
  },
  {
    name: "zeabur-static" as const,
    static: true,
  }
);

export default [zeabur, zeaburStatic] as const;
