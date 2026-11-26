import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Nitro } from "nitro/types";
import serverAssets from "../../src/build/virtual/server-assets.ts";

describe("server assets", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "nitro-server-assets-"));
    await writeFile(join(dir, "data.txt"), "data");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  async function meta(assetsMtime: boolean) {
    const nitro = {
      options: {
        dev: false,
        preset: "node-server",
        assetsMtime,
        serverAssets: [{ baseName: "server", dir }],
      },
    } as unknown as Nitro;
    const code = await (serverAssets(nitro).template as () => Promise<string>)();
    return JSON.parse(code.match(/meta: (\{.*\})/)![1]);
  }

  it("leaves mtime out with `assetsMtime: false`", async () => {
    expect((await meta(true)).mtime).toBeTypeOf("string");
    expect(await meta(false)).toEqual({
      type: "text/plain; charset=utf-8",
      etag: expect.any(String),
    });
  });
});
