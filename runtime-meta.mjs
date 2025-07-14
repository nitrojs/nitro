import { fileURLToPath } from "node:url";

export const pkgDir = fileURLToPath(new URL(".", import.meta.url));

export const runtimeDir = fileURLToPath(
  new URL("dist/runtime/", import.meta.url)
);

export const runtimeDependencies = [
  "h3",
  "cookie-es",
  "defu",
  "destr",
  "hookable",
  "iron-webcrypto",
  "klona",
  "node-fetch-native",
  "node-mock-http",
  "ofetch",
  "ohash",
  "pathe",
  "radix3",
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
];
