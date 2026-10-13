import type { ArgsDef } from "citty";

export const commonArgs = {
  dir: {
    type: "string",
    description: "project root directory",
  },
  _dir: {
    type: "positional",
    default: ".",
    description: "project root directory (prefer using `--dir`)",
  },
} satisfies ArgsDef;
