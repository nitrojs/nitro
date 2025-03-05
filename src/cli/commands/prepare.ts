import { defineCommand } from "citty";
import { createNitro, writeTypes } from "nitro/core";
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
    const rootDir = resolve((args.dir || args._dir || ".") as string);
    const nitro = await createNitro({ rootDir });
    await writeTypes(nitro);
  },
});
