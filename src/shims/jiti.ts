import { importDep } from "../utils/dep.ts";

const jiti = await importDep<typeof import("jiti")>({
  id: "jiti",
  dir: process.cwd(),
  reason: "loading config files this runtime cannot import natively",
  version: "^2.7.0",
});

export const createJiti = jiti.createJiti;
