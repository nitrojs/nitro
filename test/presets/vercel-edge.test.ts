import { promises as fsp } from "node:fs";
import { resolve } from "pathe";
import { EdgeRuntime } from "edge-runtime";
import { isWindows } from "std-env";
import { describeIf, setupTest, testNitro } from "../tests";

describeIf(!isWindows, "nitro:preset:vercel-edge", async () => {
  const ctx = await setupTest("vercel-edge");
  testNitro(ctx, async () => {
    // TODO: Add add-event-listener
    const entry = resolve(ctx.outDir, "functions/__nitro.func/index.mjs");
    const initialCode = await fsp.readFile(entry, "utf8");
    const runtime = new EdgeRuntime({
      extend: (context) =>
        Object.assign(context, { process: { env: { ...ctx.env } } }),
    });
    runtime.evaluate(
      initialCode.replace(
        "export{handleEvent as default}",
        "globalThis.handleEvent = handleEvent"
      )
    );
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
