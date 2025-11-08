import { fileURLToPath } from "node:url";

import packageJson from "../../package.json" with { type: "json" };

export const version: string = packageJson.version;

export const pkgDir: string = fileURLToPath(new URL("../../", import.meta.url));

export const runtimeDir: string = fileURLToPath(new URL("./", import.meta.url));

export const presetsDir: string = fileURLToPath(
  new URL("../presets/", import.meta.url)
);

export const runtimeDependencies: string[] = [
  "crossws", // dep
  "croner", // traced
  "db0", // dep
  "defu", // traced
  "destr", // traced
  "h3", // dep
  "rou3", // sub-dep of h3
  "hookable", // traced
  "ofetch", // dep
  "ohash", // traced
  "rendu", // traced
  "scule", // traced
  "srvx", // dep
  "ufo", // traced
  "unctx", // traced
  "unenv", // dep
  "unstorage", // dep
];
