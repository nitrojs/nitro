import { readFileSync } from "node:fs";
import { execa, execaCommandSync } from "execa";
import { resolve } from "pathe";
import { getRandomPort, waitForPort } from "get-port-please";
import { describe, expect, it } from "vitest";
import { setupTest, testNitro } from "../tests";

const hasDeno =
  execaCommandSync("deno --version", { stdio: "ignore", reject: false })
    .exitCode === 0;

describe.runIf(hasDeno)("nitro:preset:deno-server", async () => {
  const ctx = await setupTest("deno-server");
  testNitro(ctx, async () => {
    const port = await getRandomPort();
    const p = execa("deno", ["task", "start"], {
      cwd: ctx.outDir,
      // stdio: "inherit",
      stdio: "ignore",
      env: {
        NITRO_PORT: String(port),
        NITRO_HOST: "127.0.0.1",
      },
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

  it("listens on a random port with NITRO_PORT=0", async () => {
    // Run the start task command directly (not via `deno task`) so `p.kill()` stops the server
    const denoJSON = JSON.parse(
      readFileSync(resolve(ctx.outDir, "deno.json"), "utf8")
    );
    const [cmd, ...args] = denoJSON.tasks.start.split(" ");
    const p = execa(cmd, args, {
      cwd: ctx.outDir,
      stdio: ["ignore", "pipe", "ignore"],
      env: { NITRO_PORT: "0", NITRO_HOST: "127.0.0.1" },
    });
    try {
      const port = await new Promise<number>((resolve, reject) => {
        let out = "";
        p.stdout!.on("data", (chunk) => {
          out += chunk;
          const match = out.match(/Listening .*:(\d+)\r?\n/);
          if (match) {
            resolve(Number(match[1]));
          }
        });
        p.catch(reject);
      });
      expect(port).toBeGreaterThan(0);
      expect(port).not.toBe(3000);
      const res = await fetch(`http://127.0.0.1:${port}/api/hello`);
      expect(await res.json()).toEqual({ message: "Hello API" });
    } finally {
      p.kill();
    }
  });
});
