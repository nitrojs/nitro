import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { join } from "pathe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startPreview, type PreviewInstance } from "../../src/preview.ts";

const isPosix = process.platform !== "win32";

const WRANGLER_BIN = `import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const markerDir = dirname(fileURLToPath(import.meta.url));
const portIndex = process.argv.indexOf("--port");
const port = Number(process.argv[portIndex + 1]);
const grandchild = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
  stdio: "ignore",
});
writeFileSync(join(markerDir, "grandchild.pid"), String(grandchild.pid));
const server = createServer((_req, res) => res.end("ok"));
server.listen(port, "localhost", () => writeFileSync(join(markerDir, "listening"), ""));
process.on("SIGTERM", () => {
  writeFileSync(join(markerDir, "sigterm"), "");
  grandchild.kill("SIGTERM");
  grandchild.once("exit", () => {
    writeFileSync(join(markerDir, "grandchild-exit"), "");
    setTimeout(() => {
      writeFileSync(join(markerDir, "exit"), "");
      process.exit(0);
    }, 150);
  });
});
`;

async function waitForFile(path: string, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      await stat(path);
      return;
    } catch {
      await delay(25);
    }
  }
  throw new Error(`Timed out waiting for ${path}`);
}

function isProcessAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForProcessExit(pid: number, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (!isProcessAlive(pid)) {
      return true;
    }
    await delay(25);
  }
  return false;
}

describe("preview wrangler process", () => {
  let rootDir: string;
  let packageDir: string;
  let binDir: string;
  let preview: PreviewInstance | undefined;
  let grandchildPid: number | undefined;

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), "nitro-preview-wrangler-"));
    packageDir = join(rootDir, "node_modules/wrangler");
    binDir = join(packageDir, "bin");
    await mkdir(binDir, { recursive: true });
    await writeFile(
      join(packageDir, "package.json"),
      JSON.stringify({
        name: "wrangler",
        version: "0.0.0",
        bin: { wrangler: "./bin/wrangler.mjs" },
      })
    );
    await writeFile(join(binDir, "wrangler.mjs"), WRANGLER_BIN);
    await mkdir(join(rootDir, ".output"), { recursive: true });
    await writeFile(
      join(rootDir, ".output/nitro.json"),
      JSON.stringify({
        date: new Date(Date.now() + 60_000).toJSON(),
        preset: "cloudflare-module",
        versions: { nitro: "3" },
        commands: { preview: "npx wrangler dev" },
      })
    );
  });

  afterEach(async () => {
    try {
      if (preview) {
        await Promise.race([preview.close(), delay(6000)]);
      }
    } catch {
      // Best effort cleanup.
    }
    if (isPosix) {
      const pid =
        grandchildPid ??
        Number(await readFile(join(binDir, "grandchild.pid"), "utf8").catch(() => "0"));
      if (pid) {
        try {
          process.kill(pid, "SIGKILL");
        } catch {
          // Already gone.
        }
      }
    }
    await rm(rootDir, { recursive: true, force: true });
  });

  it("waits for wrangler to exit and cleans up the process tree", async () => {
    const sigintListeners = process.listenerCount("SIGINT");
    const sighupListeners = process.listenerCount("SIGHUP");

    preview = await startPreview({ rootDir });
    await waitForFile(join(binDir, "listening"));
    await waitForFile(join(binDir, "grandchild.pid"));
    grandchildPid = Number(await readFile(join(binDir, "grandchild.pid"), "utf8"));
    expect(grandchildPid).toBeGreaterThan(0);
    if (isPosix) {
      expect(isProcessAlive(grandchildPid)).toBe(true);
    }

    await preview.close();

    await stat(join(binDir, "sigterm"));
    await stat(join(binDir, "exit"));
    await stat(join(binDir, "grandchild-exit"));

    if (isPosix) {
      expect(await waitForProcessExit(grandchildPid)).toBe(true);
    }

    await preview.close();
    expect(process.listenerCount("SIGINT")).toBe(sigintListeners);
    expect(process.listenerCount("SIGHUP")).toBe(sighupListeners);
  }, 20_000);
});
