import { useNitroApp } from "nitro/app";

// `serverFetch` from `nitro` reads the app from `globalThis.__nitro__`: create it on first access.
const registry = (globalThis.__nitro__ ??= {});
if (!Object.hasOwn(registry, "default")) {
  Object.defineProperty(registry, "default", {
    configurable: true,
    enumerable: true,
    get: () => useNitroApp(),
    set: (value) => {
      Object.defineProperty(registry, "default", {
        value,
        configurable: true,
        enumerable: true,
        writable: true,
      });
    },
  });
}
