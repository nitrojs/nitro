import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execa, execaSync } from "execa";
import { join } from "pathe";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const rootDir = fileURLToPath(new URL("./websocket-fixture", import.meta.url));
const vitePkg = process.env.NITRO_VITE_PKG || "vite";

const hasBun = execaSync("bun", ["--version"], { stdio: "ignore", reject: false }).exitCode === 0;

// #3939: the dev worker used to load the Node `crossws` adapter unconditionally, so WebSocket
// upgrades broke as soon as the worker ran in another runtime (`bun --bun vite dev`). Both cases
// run a real dev server in a child process, because the runtime under test is the one that has to
// start it.
describe("vite: websocket", { sequential: true }, () => {
  let tmpDir: string;
  let script: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "nitro-vite-ws-"));
    script = join(tmpDir, "dev.mjs");
    writeFileSync(
      script,
      [
        `import { createServer } from ${JSON.stringify(import.meta.resolve(vitePkg))};`,
        `const server = await createServer({ root: ${JSON.stringify(rootDir)}, logLevel: "warn" });`,
        `await server.listen(0);`,
        `console.log("ready:" + server.httpServer.address().port);`,
      ].join("\n")
    );
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("echoes messages (node)", () => echoOverWebSocket(process.execPath, [script]), 60_000);

  test.runIf(hasBun)(
    "echoes messages (bun)",
    () => echoOverWebSocket("bun", ["--bun", script]),
    60_000
  );

  async function echoOverWebSocket(command: string, args: string[]) {
    const child = execa(command, args, { cwd: rootDir, reject: false });
    let output = "";
    child.stdout!.on("data", (data) => (output += data));
    child.stderr!.on("data", (data) => (output += data));
    try {
      const deadline = Date.now() + 30_000;
      while (!/ready:\d+/.test(output) && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const port = Number(output.match(/ready:(\d+)/)?.[1]);
      expect(port, output).toBeGreaterThan(0);
      expect(await collectMessages(`ws://localhost:${port}/ws`), output).toEqual([
        "ready",
        "echo:hi",
      ]);
    } finally {
      child.kill("SIGKILL");
    }
  }
});

// Connects, sends one message and resolves with everything the server sent back.
function collectMessages(url: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const messages: string[] = [];
    const ws = new WebSocket(url);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error(`Timed out waiting for a WebSocket echo (received: ${messages})`));
    }, 20_000);
    const done = (error?: unknown) => {
      clearTimeout(timer);
      ws.close();
      if (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      } else {
        resolve(messages);
      }
    };
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
