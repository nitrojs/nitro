import { importDep } from "../utils/dep.ts";

const giget = await importDep<typeof import("giget")>({
  id: "giget",
  dir: process.cwd(),
  reason: "extending the config from a remote template",
});

export const downloadTemplate = giget.downloadTemplate;
