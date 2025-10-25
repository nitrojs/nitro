import { fileURLToPath } from "node:url";

export const pkgDir = fileURLToPath(new URL("..", import.meta.url));

export const runtimeDir = fileURLToPath(
  new URL("../../dist/runtime/", import.meta.url)
);

export const presetsDir = fileURLToPath(
  new URL("../../dist/presets/", import.meta.url)
);

export const runtimeDependencies = [
  "h3",
  "cookie-es",
  "defu",
  "destr",
  "hookable",
  "iron-webcrypto",
  "klona",
  "node-mock-http",
  "ofetch",
  "ohash",
  "pathe",
  "rou3",
  "srvx",
  "scule",
  "ufo",
  "db0",
  "std-env",
  "uncrypto",
  "unctx",
  "unenv",
  "unstorage",
  "crossws",
  "croner",
  "rendu",
  "nitro/runtime",
  "nitro/deps/h3",
  "nitro/deps/ofetch",
];
