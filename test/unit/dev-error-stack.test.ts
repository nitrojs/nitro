import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { pathToFileURL } from "node:url";
import { build } from "rolldown";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  getFrames,
  loadStackTrace,
  parseFrame,
  parseStack,
  relativePath,
} from "../../src/runtime/internal/error/_stack.ts";
import { getCodeFrame } from "../../src/runtime/internal/error/_utils.ts";

describe("dev error: parseFrame", () => {
  it.each([
    [
      "    at foo (/app/server/routes/index.ts:10:5)",
      { fn: "foo", file: "/app/server/routes/index.ts", line: 10, col: 5, type: "app" },
    ],
    ["    at /app/index.mjs:1:2", { fn: undefined, file: "/app/index.mjs", line: 1, col: 2 }],
    [
      "    at async handler (file:///app/index.mjs:3:4)",
      { fn: "handler", file: "/app/index.mjs", line: 3, col: 4, async: true, type: "app" },
    ],
    ["    at async file:///app/index.mjs:3:4", { file: "/app/index.mjs", async: true }],
    ["    at new Foo (/app/foo.ts:1:1)", { fn: "new Foo", file: "/app/foo.ts" }],
    [
      "    at Object.<anonymous> (/app/node_modules/h3/dist/index.mjs:5:6)",
      { fn: "Object.<anonymous>", type: "module" },
    ],
    [
      "    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)",
      { file: "node:internal/process/task_queues", type: "native" },
    ],
    ["    at Array.map (<anonymous>)", { fn: "Array.map", file: undefined, type: "native" }],
    ["    at async Promise.all (index 0)", { fn: "Promise.all", file: undefined, type: "native" }],
    ["    at native", { file: undefined, type: "native" }],
    ["    at handler (/app/node_modules/.nitro/dev/index.mjs:1:2)", { type: "app" }],
    [
      "    at x (/app/node_modules/.pnpm/h3@2.0.0/node_modules/h3/dist/h3.mjs:1:2)",
      { type: "module" },
    ],
    [
      "    at eval (eval at run (/app/run.mjs:2:3), <anonymous>:1:1)",
      { fn: "eval", file: "/app/run.mjs", line: 2, col: 3, type: "app" },
    ],
    ["    ... 3 lines matching cause stack trace ...", { file: undefined, type: "native" }],
  ])("%s", (raw, expected) => {
    const frame = parseFrame(raw);
    expect(frame.raw).toBe(raw);
    for (const [key, value] of Object.entries(expected)) {
      expect(frame[key as keyof typeof frame], key).toBe(value);
    }
  });

  it("parseStack skips multiline header", () => {
    const frames = parseStack("Error: line1\nline2\n    at a (/x/a.ts:1:1)\n    at /x/b.ts:2:2\n");
    expect(frames.map((f) => f.file)).toEqual(["/x/a.ts", "/x/b.ts"]);
  });

  it("parseStack ignores message lines starting with `at`", () => {
    const frames = parseStack("Error: failed\nat validation step 3 of 7\n    at a (/x/a.ts:1:1)");
    expect(frames.map((f) => f.raw)).toEqual(["    at a (/x/a.ts:1:1)"]);
  });
});

describe("dev error: relativePath", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shortens paths inside the working directory", () => {
    vi.spyOn(process, "cwd").mockReturnValue("/app");
    expect(relativePath("/app/server/routes/index.ts")).toBe("./server/routes/index.ts");
    expect(relativePath("/application/index.ts")).toBe("/application/index.ts");
    expect(relativePath("/other/index.ts")).toBe("/other/index.ts");
  });

  it("shortens Windows paths with either separator", () => {
    vi.spyOn(process, "cwd").mockReturnValue(String.raw`C:\app`);
    // Vite reports module paths with `/`, Node with `\`
    expect(relativePath("C:/app/server/routes/index.ts")).toBe("./server/routes/index.ts");
    expect(relativePath(String.raw`C:\app\server\routes\index.ts`)).toBe(
      "./server/routes/index.ts"
    );
    expect(relativePath("C:/application/index.ts")).toBe("C:/application/index.ts");
    expect(relativePath(String.raw`D:\app\index.ts`)).toBe(String.raw`D:\app\index.ts`);
  });

  it("ignores drive letter case on Windows", () => {
    vi.spyOn(process, "cwd").mockReturnValue(String.raw`c:\app`);
    expect(relativePath("C:/app/server/routes/index.ts")).toBe("./server/routes/index.ts");
    vi.spyOn(process, "cwd").mockReturnValue(String.raw`C:\app`);
    expect(relativePath("c:/app/server/routes/index.ts")).toBe("./server/routes/index.ts");
  });

  it("shortens Windows UNC paths", () => {
    vi.spyOn(process, "cwd").mockReturnValue(String.raw`\\server\share\app`);
    expect(relativePath("//server/share/app/server/routes/index.ts")).toBe(
      "./server/routes/index.ts"
    );
    expect(relativePath(String.raw`\\server\share\app\index.ts`)).toBe("./index.ts");
    expect(relativePath("//server/share/application/index.ts")).toBe(
      "//server/share/application/index.ts"
    );
  });
});

describe("dev error: loadStackTrace", () => {
  let dir: string;
  const source = [
    "// header comment",
    "interface Input { value: number }",
    "",
    "export function fail(input: Input): never {",
    "  throw new TypeError(`bad ${input.value}`);",
    "}",
    "",
  ].join("\n");

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "nitro-dev-error-"));
    await writeFile(join(dir, "src.ts"), source);
    for (const [name, sourcemap] of [
      ["file", true],
      ["inline", "inline"],
    ] as const) {
      await build({
        input: join(dir, "src.ts"),
        logLevel: "silent",
        output: { file: join(dir, `${name}/out.mjs`), sourcemap, format: "esm" },
      });
    }
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  async function generatedPosition(file: string) {
    const { readFile } = await import("node:fs/promises");
    const lines = (await readFile(file, "utf8")).split("\n");
    const line = lines.findIndex((l) => l.includes("throw new TypeError"));
    return { line: line + 1, col: lines[line]!.indexOf("throw") + 1 };
  }

  for (const name of ["file", "inline"]) {
    it(`maps frames with ${name} source map`, async () => {
      const bundle = join(dir, `${name}/out.mjs`);
      const { line, col } = await generatedPosition(bundle);
      const error = new TypeError("bad 1");
      error.stack = [
        "TypeError: bad 1",
        `    at fail (${pathToFileURL(bundle).href}:${line}:${col})`,
        "    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)",
      ].join("\n");

      await loadStackTrace(error);

      const srcFile = join(dir, "src.ts");
      expect(error.stack).toBe(
        [
          "bad 1",
          `    at fail (${srcFile}:5:3)`,
          "    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)",
        ].join("\n")
      );
      const [frame] = getFrames(error);
      expect(frame).toMatchObject({ file: srcFile, line: 5, col: 3, type: "app", source });

      // Code frame comes from `sourcesContent`
      await rm(srcFile, { force: true });
      const codeFrame = await getCodeFrame(frame!, { context: 1 });
      await writeFile(srcFile, source);
      expect(codeFrame).toMatchObject({ start: 4, line: 5, col: 3 });
      expect(codeFrame!.lines.map((l) => l.map((t) => t.text).join(""))).toEqual([
        "export function fail(input: Input): never {",
        "  throw new TypeError(`bad ${input.value}`);",
        "}",
      ]);
      expect(codeFrame!.lines[1]).toContainEqual({ text: "throw", type: "kwd" });
    });
  }

  it("maps frames to virtual module sources (with `#`)", async () => {
    const { mkdir, readFile, copyFile } = await import("node:fs/promises");
    await mkdir(join(dir, "virtual"), { recursive: true });
    const bundle = join(dir, "virtual/out.mjs");
    await copyFile(join(dir, "file/out.mjs"), bundle);
    const map = JSON.parse(await readFile(join(dir, "file/out.mjs.map"), "utf8"));
    map.sources = ["../#nitro/virtual/app"];
    await writeFile(`${bundle}.map`, JSON.stringify(map));
    const { line, col } = await generatedPosition(bundle);
    const error = new TypeError("bad 1");
    error.stack = `TypeError: bad 1\n    at fail (${bundle}:${line}:${col})`;

    await loadStackTrace(error);

    const [frame] = getFrames(error);
    expect(frame).toMatchObject({ file: join(dir, "#nitro/virtual/app"), line: 5, col: 3, source });
    const codeFrame = await getCodeFrame(frame!, { context: 0 });
    expect(codeFrame!.lines[0]).toContainEqual({ text: "throw", type: "kwd" });
  });

  it("keeps frames without a source map (already mapped stacks)", async () => {
    const error = new Error("mapped");
    const srcFile = join(dir, "src.ts");
    error.stack = `Error: mapped\n    at fail (${srcFile}:5:3)\n    at async run (${srcFile}:2:1)`;
    await loadStackTrace(error);
    expect(error.stack).toBe(
      `mapped\n    at fail (${srcFile}:5:3)\n    at async run (${srcFile}:2:1)`
    );
    const codeFrame = await getCodeFrame(getFrames(error)[0]!, { context: 0 });
    expect(codeFrame!.lines[0]!.map((t) => t.text).join("")).toBe(
      "  throw new TypeError(`bad ${input.value}`);"
    );
  });

  it("maps causes and aggregate errors and handles cycles", async () => {
    const bundle = join(dir, "file/out.mjs");
    const { line, col } = await generatedPosition(bundle);
    const frame = `    at fail (${bundle}:${line}:${col})`;
    const inner = Object.assign(new Error("inner"), { stack: `Error: inner\n${frame}` });
    const agg = new AggregateError([inner], "agg");
    agg.stack = `AggregateError: agg\n${frame}`;
    const error = new Error("outer", { cause: agg });
    error.stack = `Error: outer\n${frame}`;
    (inner as any).cause = error;

    await loadStackTrace(error);

    for (const err of [error, agg, inner]) {
      expect(err.stack).toContain(`${join(dir, "src.ts")}:5:3`);
    }
  });
});
