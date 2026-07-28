import { mkdtemp, readFile, readdir, rm, writeFile as fspWriteFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { join } from "pathe";
import { writeFile } from "../../src/utils/fs.ts";

describe("writeFile", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "nitro-fs-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("writes contents and creates missing parent directories", async () => {
    const file = join(dir, "nested/deeply/index.html");

    await writeFile(file, "<h1>hello</h1>");

    expect(await readFile(file, "utf8")).toBe("<h1>hello</h1>");
  });

  it("leaves no temporary files behind", async () => {
    await writeFile(join(dir, "index.html"), "<h1>hello</h1>");

    expect(await readdir(dir)).toEqual(["index.html"]);
  });

  it("overwrites an existing file", async () => {
    const file = join(dir, "index.html");
    await fspWriteFile(file, "old");

    await writeFile(file, "new");

    expect(await readFile(file, "utf8")).toBe("new");
  });

  it("never leaves a file torn between two concurrent writers", async () => {
    // Two prerender routes can resolve to a single output file, and with
    // `prerender.concurrency > 1` their writes overlap. A non-atomic write then
    // leaves the longer payload's tail after the shorter payload's body.
    const file = join(dir, "other/index.html");
    const long = Buffer.from("L".repeat(300));
    const short = Buffer.from("S".repeat(256));

    for (let i = 0; i < 100; i++) {
      await Promise.all([writeFile(file, long), writeFile(file, short)]);

      const written = await readFile(file);
      const isWhole = written.equals(long) || written.equals(short);
      expect(isWhole, `torn after ${written.length} bytes on run ${i}`).toBe(true);
    }
  });
});
