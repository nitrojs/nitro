// https://vitest.dev/guide/environment#custom-environment

/** @type {import("vitest/environments").Environment} */
export default {
  name: "nitro",
  viteEnvironment: "nitro",
  setup() {
    return {
      async teardown() {
        const nitroApp = globalThis.__nitro__?.default;
        if (!nitroApp) {
          return;
        }
        delete globalThis.__nitro__.default;
        await nitroApp.hooks?.callHook("close");
      },
    };
  },
};
