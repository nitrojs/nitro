import { defineCommand } from "citty";
import { createNitro, writeTypes } from "nitropack/core";
import { resolve } from "pathe";
import { commonArgs } from "../common";

export default defineCommand({
  meta: {
    name: "prepare",
    description: "Generate types for the project",
  },
  args: {
    ...commonArgs,
  },
  async run({ args }) {
    const cwd = resolve((args.dir || args._dir || ".") as string);
    const rootDir = args.dir || args._dir ? cwd : undefined;
    const nitro = await createNitro({ rootDir }, { cwd });
    await writeTypes(nitro);
  },
});
