import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import type { Nitro } from "nitro/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeNeonOutput } from "../../src/presets/neon/utils.ts";

describe("writeNeonOutput", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "nitro-neon-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  function createNitro(output: { serverDir: string; publicDir: string }) {
    return {
      options: { rootDir: dir, output: { dir, ...output }, scheduledTasks: {} },
      logger: { warn: vi.fn(), info: vi.fn() },
    } as unknown as Nitro;
  }

  it("writes a root entry that re-exports the server entry", async () => {
    await writeNeonOutput(
      createNitro({ serverDir: join(dir, "server"), publicDir: join(dir, "public") })
    );

    expect(await readFile(join(dir, "index.mjs"), "utf8")).toBe(
      `export { default } from "./server/index.mjs";\n`
    );
  });

  it("keeps the server entry when `output.serverDir` is `output.dir`", async () => {
    const handler = "export default { fetch: () => new Response('ok') };\n";
    await writeFile(join(dir, "index.mjs"), handler);

    await writeNeonOutput(createNitro({ serverDir: dir, publicDir: join(dir, "public") }));

    expect(await readFile(join(dir, "index.mjs"), "utf8")).toBe(handler);
  });
});
