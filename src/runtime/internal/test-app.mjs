// App of a test file, for the Vitest and Rstest integrations

/**
 * `serverFetch` from `nitro` reads the app from `globalThis.__nitro__`: creates it on first access.
 * Called before the tests of a file, so Nitro plugins are imported after its mocks are registered.
 */
export async function registerTestApp() {
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
}

/** Runs the `close` hooks of the app (if it was created) once the tests of a file finished. */
export async function closeTestApp() {
  // Read the descriptor: the lazy getter would create the app
  const nitroApp = Object.getOwnPropertyDescriptor(globalThis.__nitro__ || {}, "default")?.value;
  try {
    await nitroApp?.hooks?.callHook("close");
  } finally {
    delete globalThis.__nitro__?.default;
  }
}
