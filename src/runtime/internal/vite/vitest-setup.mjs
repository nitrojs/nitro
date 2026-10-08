import { beforeAll } from "vitest";

// `serverFetch` from `nitro` reads the app from `globalThis.__nitro__`: create it on first access.
// Deferred to `beforeAll` so Nitro plugins are imported after the test file's `vi.mock` calls.
beforeAll(async () => {
  const { useNitroApp } = await import("nitro/app");
  const registry = (globalThis.__nitro__ ??= {});
  if (Object.hasOwn(registry, "default")) {
    return;
  }
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
});
