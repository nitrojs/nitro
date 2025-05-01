import type { ArgsDef } from "citty";

export const commonArgs = <ArgsDef>{
  dir: {
    type: "string",
    description: "project root directory",
  },
  _dir: {
    type: "positional",
    required: false,
    description: "project root directory (prefer using `--dir`)",
  },
};
