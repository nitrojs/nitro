import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isCaseInsensitiveFS } from "../../src/utils/fs.ts";

describe("isCaseInsensitiveFS", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "nitro-fs-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("detects the default case sensitivity of the platform", async () => {
    expect(await isCaseInsensitiveFS(dir)).toBe(process.platform !== "linux");
  });

  it("leaves no probe file behind", async () => {
    await isCaseInsensitiveFS(dir);

    expect(await readdir(dir)).toEqual([]);
  });

  it("creates a missing directory", async () => {
    await isCaseInsensitiveFS(join(dir, "public"));

    expect(await readdir(dir)).toEqual(["public"]);
  });
});
