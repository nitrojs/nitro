import { fileURLToPath } from "node:url";

import packageJson from "../../package.json" with { type: "json" };

export const version: string = packageJson.version;

const resolve = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export const runtimeDir: string = /* @__PURE__ */ resolve("./");
export const presetsDir: string = /* @__PURE__ */ resolve("../presets/");
export const pkgDir: string = /* @__PURE__ */ resolve("../../");

export const runtimeDependencies: string[] = [
  "crossws", // dep
  "h3", // dep
  "ocache", // dep
  "rou3", // sub-dep of h3
  "srvx", // dep
];
