import { importDep } from "../utils/dep.ts";

const dotenv = await importDep<typeof import("dotenv")>({
  id: "dotenv",
  dir: process.cwd(),
  reason: "parsing `.env` files (`node:util.parseEnv` is not available in this runtime)",
  version: "^16 || ^17 || ^18",
});

export const parse = dotenv.parse;
