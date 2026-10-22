import { mkdir, mkdtemp, readFile, readdir, rm, writeFile as fspWriteFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { join } from "pathe";
import { writeFileAtomic } from "../../src/utils/fs.ts";

describe("writeFileAtomic", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "nitro-fs-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("writes contents and creates missing parent directories", async () => {
    const file = join(dir, "nested/deeply/index.html");

    await writeFileAtomic(file, "<h1>hello</h1>");

    expect(await readFile(file, "utf8")).toBe("<h1>hello</h1>");
  });

  it("leaves no temporary files behind", async () => {
    await writeFileAtomic(join(dir, "index.html"), "<h1>hello</h1>");

    expect(await readdir(dir)).toEqual(["index.html"]);
  });

  it("overwrites an existing file", async () => {
    const file = join(dir, "index.html");
    await fspWriteFile(file, "old");

    await writeFileAtomic(file, "new");

    expect(await readFile(file, "utf8")).toBe("new");
  });

  it("writes a file whose name is close to the length limit", async () => {
    const file = join(dir, `${"a".repeat(250)}.html`);

    await writeFileAtomic(file, "<h1>hello</h1>");

    expect(await readFile(file, "utf8")).toBe("<h1>hello</h1>");
  });

  it("removes the temporary file when the write cannot be completed", async () => {
    const file = join(dir, "index.html");
    await mkdir(join(file, "nested"), { recursive: true });

    await expect(writeFileAtomic(file, "<h1>hello</h1>")).rejects.toThrow();

    expect(await readdir(dir)).toEqual(["index.html"]);
  });

  it("never leaves a file torn between two concurrent writers", async () => {
    // Prerender routes with different paths can still alias one file (e.g. on a
    // case-insensitive filesystem), and with `prerender.concurrency > 1` their writes
    // overlap. A non-atomic write then leaves the longer payload's tail after the
    // shorter payload's body.
    const file = join(dir, "other/index.html");
    const long = Buffer.from("L".repeat(300));
    const short = Buffer.from("S".repeat(256));

    for (let i = 0; i < 100; i++) {
      await Promise.all([writeFileAtomic(file, long), writeFileAtomic(file, short)]);

      const written = await readFile(file);
      const isWhole = written.equals(long) || written.equals(short);
      expect(isWhole, `torn after ${written.length} bytes on run ${i}`).toBe(true);
    }
  });
});
