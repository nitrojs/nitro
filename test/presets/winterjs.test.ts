import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { execa, execaSync } from "execa";
import { getRandomPort, waitForPort } from "get-port-please";
import { join } from "pathe";
import { describe } from "vitest";
import { setupTest, testNitro } from "../tests.ts";

const wasmer = await resolveWasmer();

describe.runIf(wasmer)("nitro:preset:winterjs", async () => {
  const ctx = await setupTest("winterjs");
  testNitro(ctx, async () => {
    const port = await getRandomPort();
    const p = execa(
      wasmer!,
      [
        "run",
        "wasmer/winterjs",
        "--forward-host-env",
        "--net",
        "--mapdir",
        "app:" + ctx.outDir,
        "app/server/index.mjs",
      ],
      {
        stdio: process.env.TEST_DEBUG ? "inherit" : "ignore",
        reject: false,
        env: {
          ...ctx.env,
          LISTEN_IP: "127.0.0.1",
          PORT: String(port),
        },
      }
    );
    ctx.server = {
      url: `http://127.0.0.1:${port}`,
      close: () => p.kill(),
    } as any;
    await waitForPort(port, { delay: 1000, retries: 30, host: "127.0.0.1" });
    return async ({ url, ...opts }) => {
      const res = await ctx.fetch(url, opts);
      return res;
    };
  });
});

// Resolves the `wasmer` runner used to run WinterJS. Falls back to downloading a
// release into a cached temporary dir when `DOWNLOAD_WASMER` is set (opt-in, as
// it needs network access), otherwise the suite is skipped.
async function resolveWasmer(): Promise<string | undefined> {
  if (execaSync("wasmer", ["--version"], { stdio: "ignore", reject: false }).exitCode === 0) {
    return "wasmer";
  }
  if (!process.env.DOWNLOAD_WASMER) {
    return undefined;
  }

  const dir = join(tmpdir(), "nitro-tests-wasmer");
  const bin = join(dir, "bin/wasmer");
  if (existsSync(bin)) {
    return bin;
  }

  const os = { linux: "linux", darwin: "darwin" }[process.platform as string];
  const arch = { x64: "amd64", arm64: process.platform === "darwin" ? "arm64" : "aarch64" }[
    process.arch as string
  ];
  if (!os || !arch) {
    throw new Error(`DOWNLOAD_WASMER: unsupported platform (${process.platform}-${process.arch})`);
  }

  const url = `https://github.com/wasmerio/wasmer/releases/latest/download/wasmer-${os}-${arch}.tar.gz`;
  console.log(`[winterjs] downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`DOWNLOAD_WASMER: ${url} responded with ${res.status}`);
  }

  const archive = join(dir, "wasmer.tar.gz");
  await mkdir(dir, { recursive: true });
  await writeFile(archive, new Uint8Array(await res.arrayBuffer()));
  await execa("tar", ["-xzf", archive, "-C", dir]);
  await rm(archive);

  return bin;
}
