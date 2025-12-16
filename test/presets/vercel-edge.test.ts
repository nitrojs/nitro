import { promises as fsp } from "node:fs";
import { EdgeRuntime } from "edge-runtime";
import { resolve } from "pathe";
import { isWindows } from "std-env";
import { describeIf, setupTest, testNitro } from "../tests";

describeIf(!isWindows, "nitro:preset:vercel-edge", async () => {
  const ctx = await setupTest("vercel-edge", {
    config: {
      minify: false,
    },
  });
  testNitro(ctx, async () => {
    const entry = resolve(ctx.outDir, "functions/__fallback.func/index.mjs");

    const init = (await fsp.readFile(entry, "utf8"))
      .replace(
        /export ?{ ?handleEvent as default ?}/,
        "globalThis.handleEvent = handleEvent"
      )
      // TODO: we can use AST to replace this.
      // This is only needed for testing via EdgeRuntime since unlike prod (workerd?), it is a simple Node.js isolate
      .replace(
        /import\s+(.+)\s+from\s+['"](node:[^'"]+)['"]/g,
        "const $1 = process.getBuiltinModule('$2')"
      )
      .replace(
        `const nodeAsyncHooks, { AsyncLocalStorage } = process.getBuiltinModule('node:async_hooks');`,
        `const nodeAsyncHooks = process.getBuiltinModule('node:async_hooks'); const { AsyncLocalStorage } = nodeAsyncHooks;`
      );

    const runtime = new EdgeRuntime({
      extend: (context) =>
        Object.assign(context, {
          process: {
            env: { ...ctx.env },
            getBuiltinModule: process.getBuiltinModule,
          },
        }),
    });

    await runtime.evaluate(`(async function() { ${init} })()`);

    return async ({ url, headers, method, body }) => {
      const isGet = ["get", "head"].includes((method || "get").toLowerCase());
      const res = await runtime.evaluate(
        `handleEvent(new Request(new URL("http://localhost${url}"), {
          headers: new Headers(${JSON.stringify(headers || {})}),
          method: ${JSON.stringify(method || "get")},
          ${isGet ? "" : `body: ${JSON.stringify(body)},`}
        }))`
      );
      return res;
    };
  });
});
