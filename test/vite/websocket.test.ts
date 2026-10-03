import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execa, execaSync } from "execa";
import { join } from "pathe";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const rootDir = fileURLToPath(new URL("./websocket-fixture", import.meta.url));
const vitePkg = process.env.NITRO_VITE_PKG || "vite";

const hasBun = execaSync("bun", ["--version"], { stdio: "ignore", reject: false }).exitCode === 0;

// #3939: the dev worker loaded the Node `crossws` adapter unconditionally, so WebSocket upgrades
// broke as soon as it ran in another runtime (`bun --bun`). Each case starts a real dev server in a
// child process, because the runtime under test is the one that has to run it.
describe("dev: websocket", { concurrent: false }, () => {
  let tmpDir: string;
  const scripts = {} as Record<"vite" | "nitro", string>;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "nitro-dev-ws-"));
    scripts.vite = join(tmpDir, "vite.mjs");
    writeFileSync(
      scripts.vite,
      /* js */ `
import { createServer } from ${JSON.stringify(import.meta.resolve(vitePkg))};
const server = await createServer({ root: ${JSON.stringify(rootDir)}, logLevel: "warn" });
await server.listen(0);
console.log("ready:" + server.resolvedUrls.local[0]);
`
    );
    scripts.nitro = join(tmpDir, "nitro.mjs");
    writeFileSync(
      scripts.nitro,
      /* js */ `
import { build, createDevServer, createNitro, prepare } from ${JSON.stringify(import.meta.resolve("nitro/builder"))};
const nitro = await createNitro({
  rootDir: ${JSON.stringify(rootDir)},
  buildDir: ${JSON.stringify(join(tmpDir, ".nitro"))},
  dev: true,
  builder: "rolldown",
  serverDir: "./",
  features: { websocket: true },
});
const server = await createDevServer(nitro).listen({ port: 0, hostname: "127.0.0.1" });
const ready = new Promise((resolve) => nitro.hooks.hook("dev:reload", resolve));
await prepare(nitro);
await build(nitro);
await ready;
console.log("ready:" + server.url);
`
    );
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  for (const dev of ["vite", "nitro"] as const) {
    test(`${dev} dev (node)`, () => echo(process.execPath, [scripts[dev]]), 60_000);
    test.runIf(hasBun)(`${dev} dev (bun)`, () => echo("bun", ["--bun", scripts[dev]]), 60_000);
  }
});

async function echo(command: string, args: string[]) {
  const child = execa(command, args, { cwd: rootDir, reject: false });
  let output = "";
  child.stdout!.on("data", (data) => (output += data));
  child.stderr!.on("data", (data) => (output += data));
  try {
    const deadline = Date.now() + 30_000;
    while (!/ready:\S+/.test(output) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const url = output.match(/ready:(\S+)/)?.[1];
    expect(url, output).toBeTruthy();
    // First request on a fresh server: the upgrade must wait for the app entry.
    expect(await collectMessages(new URL("/ws", url!.replace(/^http/, "ws")).href), output).toEqual(
      ["ready", "echo:hi"]
    );
  } finally {
    child.kill("SIGKILL");
  }
}

// Connects, sends one message and resolves with everything the server sent back.
function collectMessages(url: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const messages: string[] = [];
    const ws = new WebSocket(url);
    const done = (error?: string) => {
      clearTimeout(timer);
      ws.close();
      if (error) {
        reject(new Error(`${error} (received: ${JSON.stringify(messages)})`));
      } else {
        resolve(messages);
      }
    };
    const timer = setTimeout(() => done("Timed out waiting for a WebSocket echo"), 20_000);
    ws.addEventListener("open", () => ws.send("hi"));
    ws.addEventListener("error", () => done("WebSocket connection failed"));
    ws.addEventListener("close", () => done());
    ws.addEventListener("message", (event) => {
      messages.push(String(event.data));
      if (messages.length >= 2) {
        done();
      }
    });
  });
}
