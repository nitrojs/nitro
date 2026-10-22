import { shims } from "../utils/_deps.ts";
import { importDep } from "../utils/dep.ts";

const jiti = await importDep<typeof import("jiti")>({
  id: "jiti",
  dir: process.cwd(),
  reason: "loading config files this runtime cannot import natively",
  version: shims.jiti.version,
});

export const createJiti = jiti.createJiti;
