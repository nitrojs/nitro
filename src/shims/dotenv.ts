import { importDep } from "../utils/dep.ts";

const dotenv = await importDep<typeof import("dotenv")>({
  id: "dotenv",
  dir: process.cwd(),
  reason: "parsing `.env` files (`node:util.parseEnv` is not available in this runtime)",
});

export const parse = dotenv.parse;
