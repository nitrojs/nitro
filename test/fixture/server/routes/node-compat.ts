import nodeAsyncHooks from "node:async_hooks";
import nodeCrypto from "node:crypto";
import nodeTLS from "node:tls";

const nodeCompatTests = {
  globals: {
    // eslint-disable-next-line unicorn/prefer-global-this
    global: () => globalThis.global === global,
    // eslint-disable-next-line unicorn/prefer-global-this
    Buffer: () => Buffer && globalThis.Buffer && global.Buffer,
    // eslint-disable-next-line unicorn/prefer-global-this
    process: () => process && globalThis.process && global.process,
    BroadcastChannel: () => !!new BroadcastChannel("test"),
  },
  crypto: {
    createHash: () => {
      return nodeCrypto.createHash("sha256").update("hello").digest("hex").startsWith("2cf24");
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
  tls: {
    connect: async () => {
      // TODO: Use a local TLS server for testing
      if ("Bun" in globalThis || "Deno" in globalThis) {
        return true;
      }
      const socket = nodeTLS.connect(443, "1.1.1.1");
      await new Promise<void>((r) => socket.on("connect", r));
      socket.end();
      return true;
    },
  },
};

export default async () => {
  const results: Record<string, boolean> = {};
  for (const [group, groupTests] of Object.entries(nodeCompatTests)) {
    for (const [name, test] of Object.entries(groupTests)) {
      results[`${group}:${name}`] = await testFn(test);
    }
  }
  return new Response(JSON.stringify(results, null, 2), {
    headers: {
      "Content-Type": "application/json",
    },
  });
};

async function testFn(fn: () => any) {
  try {
    return !!(await fn());
  } catch {
    return false;
  }
}
