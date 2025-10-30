import { fileURLToPath } from "node:url";

export const pkgDir = fileURLToPath(new URL("../../", import.meta.url));

export const runtimeDir = fileURLToPath(
  new URL("../../dist/runtime/", import.meta.url)
);

export const presetsDir = fileURLToPath(
  new URL("../../dist/presets/", import.meta.url)
);

export const runtimeDependencies = [
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
  "nitro/h3",
  "nitro/deps/h3",
  "nitro/deps/ofetch",
  "nitro/runtime",
];
