import { execa, execaCommandSync } from "execa";
import { getRandomPort, waitForPort } from "get-port-please";
import { promises as fsp } from "node:fs";
import { resolve } from "pathe";
import { describe } from "vitest";
import { setupTest, testNitro } from "../tests.ts";

const hasDeno =
  execaCommandSync("deno --version", { stdio: "ignore", reject: false })
    .exitCode === 0;

describe.runIf(hasDeno)("nitro:preset:deno-handler", async () => {
  const ctx = await setupTest("deno-handler");
  testNitro(ctx, async () => {
    const port = await getRandomPort();
    // The preset emits a handler-only build; spin up a minimal Deno wrapper
    // that imports the exported `fetch` and serves it. Library users would
    // do the same in their own dispatcher or test harness.
    const wrapperPath = resolve(ctx.outDir, "server/wrapper.mjs");
    await fsp.writeFile(
      wrapperPath,
      `import { fetch } from "./index.mjs";\nDeno.serve({ port: ${port}, hostname: "127.0.0.1" }, fetch);\n`
    );
    execa("deno", ["run", "-A", wrapperPath], {
      cwd: ctx.outDir,
      stdio: "ignore",
    });
    ctx.server = {
      url: `http://127.0.0.1:${port}`,
      close: () => {
        // p.kill()
      },
    } as any;
    await waitForPort(port, { delay: 1000, retries: 20, host: "127.0.0.1" });
    return async ({ url, ...opts }) => {
      const res = await ctx.fetch(url, opts);
      return res;
    };
  });
});
