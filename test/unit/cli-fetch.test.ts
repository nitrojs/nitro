import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { describe, expect, it } from "vitest";
import { createFetchRequest, parseFetchArgs } from "../../src/cli/commands/fetch/_request.ts";

const request = (args: string[]) => createFetchRequest(parseFetchArgs(args));

describe("nitro fetch arguments", () => {
  it("resolves paths and URLs", async () => {
    expect((await request([])).url).toBe("http://localhost/");
    expect((await request(["api/hello?x=1"])).url).toBe("http://localhost/api/hello?x=1");
    expect((await request(["//api"])).url).toBe("http://localhost/api");
    expect((await request(["https://example.com/a"])).url).toBe("https://example.com/a");
  });

  it("rejects URLs with a port but no scheme", async () => {
    await expect(request(["localhost:3000/api"])).rejects.toThrow("http://localhost:3000/api");
  });

  it("parses the method and repeated headers", async () => {
    const req = await request(["/", "-X", "delete", "-H", "x-a: 1", "--header", "X-B:2"]);
    expect(req.method).toBe("DELETE");
    expect(req.headers.get("x-a")).toBe("1");
    expect(req.headers.get("x-b")).toBe("2");
    expect((await request(["-I", "/"])).method).toBe("HEAD");
    expect((await request(["-I", "-X", "POST", "/"])).method).toBe("POST");
    const repeated = await request(["--json", "{}", "-H", "accept: a", "-H", "Accept: b"]);
    expect(repeated.headers.get("accept")).toBe("a, b");
  });

  it("sends the URL host", async () => {
    expect((await request(["/"])).headers.get("host")).toBe("localhost");
    expect((await request(["http://example.com:8080/"])).headers.get("host")).toBe(
      "example.com:8080"
    );
    expect((await request(["/", "-H", "host: other"])).headers.get("host")).toBe("other");
  });

  it("joins `--data` parts as a form", async () => {
    const req = await request(["-d", "a=1", "--data-raw", "@b", "--data", "c=3"]);
    expect(req.method).toBe("POST");
    expect(req.headers.get("content-type")).toBe("application/x-www-form-urlencoded");
    expect(await req.text()).toBe("a=1&@b&c=3");
  });

  it("reads `@file` data", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nitro-fetch-"));
    try {
      await writeFile(join(dir, "body.txt"), "a\nb\n");
      expect(await (await request(["-d", `@${dir}/body.txt`])).text()).toBe("ab");
      expect(await (await request(["--data-binary", `@${dir}/body.txt`])).text()).toBe("a\nb\n");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("sends `--json` with its headers, overridable with `-H`", async () => {
    expect((await request(["--json", "{}"])).headers.get("accept")).toBe("application/json");
    const req = await request(["--json", '{"a":1}', "-H", "accept:", "-H", "content-type: x/y"]);
    expect(req.method).toBe("POST");
    expect(req.headers.get("accept")).toBeNull();
    expect(req.headers.get("content-type")).toBe("x/y");
    expect(await req.text()).toBe('{"a":1}');
    await expect(request(["--json", "{}", "-d", "a=1"])).rejects.toThrow("--json");
  });

  it("rejects unknown options and invalid headers", async () => {
    expect(() => parseFetchArgs(["-L", "/"])).toThrow("-L");
    expect(() => parseFetchArgs(["/a", "/b"])).toThrow("single URL");
    await expect(request(["-H", "invalid"])).rejects.toThrow("Invalid header");
  });
});
