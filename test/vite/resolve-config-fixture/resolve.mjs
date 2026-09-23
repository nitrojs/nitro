import { fileURLToPath } from "node:url";

const { resolveConfig } = await import(process.env.NITRO_VITE_PKG || "vite");

await resolveConfig(
  { root: fileURLToPath(new URL("../app-fixture", import.meta.url)), logLevel: "silent" },
  "serve"
);
