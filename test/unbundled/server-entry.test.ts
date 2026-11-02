import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { describe, expect, it } from "vitest";
import { startUnbundledServer } from "../../src/build/unbundled/serve.ts";

// Native ESM fails to link a default import of a module without one, so it must not be emitted
describe("nitro serve: server entry", () => {
  it.each([
    ["no default export", `console.log("startup");`, 404, undefined],
    ["default export without fetch", `export default { port: 3999 };`, 404, undefined],
    [
      "default export with fetch",
      `export default { fetch: () => new Response("from entry") };`,
      200,
      "from entry",
    ],
  ])("%s", async (_name, code, status, body) => {
    const dir = await mkdtemp(join(tmpdir(), "nitro-serve-entry-"));
    await writeFile(join(dir, "nitro.config.mjs"), `export default { serverDir: "./" };`);
    await writeFile(join(dir, "server.ts"), code);
    await mkdir(join(dir, "routes"));
    await writeFile(join(dir, "routes/hello.ts"), `export default () => "hello";`);
    const server = await startUnbundledServer({
      rootDir: dir,
      listen: { port: 0, hostname: "127.0.0.1" },
    });
    try {
      const { host, port } = server.runner.address!;
      const hello = await fetch(`http://${host}:${port}/hello`);
      expect(await hello.text()).toBe("hello");
      const res = await fetch(`http://${host}:${port}/unknown`);
      expect(res.status).toBe(status);
      if (body) {
        expect(await res.text()).toBe(body);
      }
    } finally {
      await server.close();
      await rm(dir, { recursive: true, force: true });
    }
  });
});
