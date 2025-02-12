import nodeAsyncHooks from "node:async_hooks";
import nodeCrypto from "node:crypto";

const nodeCompatTests = {
  globals: {
    // eslint-disable-next-line unicorn/prefer-global-this
    global: () => globalThis.global === global,
    // eslint-disable-next-line unicorn/prefer-global-this
    Buffer: () => Buffer && globalThis.Buffer && global.Buffer,
    // eslint-disable-next-line unicorn/prefer-global-this
    process: () => process && globalThis.process && global.process,
  },
  crypto: {
    createHash: () => {
      return nodeCrypto
        .createHash("sha256")
        .update("hello")
        .digest("hex")
        .startsWith("2cf24");
    },
  },
  async_hooks: {
    AsyncLocalStorage: async () => {
      const ctx = new nodeAsyncHooks.AsyncLocalStorage();
      const rand = Math.random();
      return ctx.run(rand, async () => {
        await new Promise<void>((r) => r());
        if (ctx.getStore() !== rand) {
          return false;
        }
        return true;
      });
    },
  },
};

export default eventHandler(async (event) => {
  const results: Record<string, boolean> = {};
  for (const [group, groupTests] of Object.entries(nodeCompatTests)) {
    for (const [name, test] of Object.entries(groupTests)) {
      results[`${group}:${name}`] = !!(await test());
    }
  }
  return new Response(JSON.stringify(results, null, 2), {
    headers: {
      "Content-Type": "application/json",
    },
  });
});
