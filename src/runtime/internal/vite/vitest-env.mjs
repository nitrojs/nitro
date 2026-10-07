// https://vitest.dev/guide/environment#custom-environment

/** @type {import("vitest/environments").Environment} */
export default {
  name: "nitro",
  viteEnvironment: "nitro",
  setup() {
    return {
      async teardown() {
        // Read the descriptor: the lazy getter (see `vitest-setup.mjs`) would create the app
        const nitroApp = Object.getOwnPropertyDescriptor(
          globalThis.__nitro__ || {},
          "default"
        )?.value;
        delete globalThis.__nitro__?.default;
        await nitroApp?.hooks?.callHook("close");
      },
    };
  },
};
