import { shims } from "../utils/_deps.ts";
import { importDep } from "../utils/dep.ts";

const giget = await importDep<typeof import("giget")>({
  id: "giget",
  dir: process.cwd(),
  reason: "extending the config from a remote template",
  version: shims.giget.version,
});

export const downloadTemplate = giget.downloadTemplate;
