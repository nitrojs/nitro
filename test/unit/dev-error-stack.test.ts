import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { fileURLToPath, pathToFileURL } from "node:url";
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

  async function mapWithCustomSourceMap(subdir: string, patch: (map: Record<string, any>) => void) {
    const { mkdir, readFile, copyFile } = await import("node:fs/promises");
    await mkdir(join(dir, subdir), { recursive: true });
    const bundle = join(dir, `${subdir}/out.mjs`);
    await copyFile(join(dir, "file/out.mjs"), bundle);
    const map = JSON.parse(await readFile(join(dir, "file/out.mjs.map"), "utf8"));
    patch(map);
    await writeFile(`${bundle}.map`, JSON.stringify(map));
    const { line, col } = await generatedPosition(bundle);
    const error = new TypeError("bad 1");
    error.stack = `TypeError: bad 1\n    at fail (${bundle}:${line}:${col})`;
    await loadStackTrace(error);
    return { error, frame: getFrames(error)[0]! };
  }

  it.each([
    ["virtual-scheme", "virtual:#nitro/virtual/app", undefined, "virtual:#nitro/virtual/app"],
    ["virtual-with-root", "virtual:#nitro/virtual/app", "/app", "virtual:#nitro/virtual/app"],
    ["nitro-scheme", "nitro:runtime/app", undefined, "nitro:runtime/app"],
    ["webpack-scheme", "webpack://app/./src/index.ts", undefined, "webpack://app/./src/index.ts"],
    [
      "https-scheme",
      "https://cdn.example.com/src.ts?v=1",
      undefined,
      "https://cdn.example.com/src.ts?v=1",
    ],
    ["null-byte-virtual", "\0virtual:nitro-app", undefined, "\0virtual:nitro-app"],
    ["null-byte-no-scheme", "\0rolldown/runtime.js", undefined, "\0rolldown/runtime.js"],
    ["null-byte-win-root", "\0virtual:nitro-app", String.raw`C:\app\src`, "\0virtual:nitro-app"],
    [
      "https-root",
      "routes/index.ts",
      "https://cdn.example.com/src",
      "https://cdn.example.com/src/routes/index.ts",
    ],
    [
      "https-root-query",
      "routes/index.ts",
      "https://cdn.example.com/src?v=1",
      "https://cdn.example.com/src/routes/index.ts",
    ],
    [
      "webpack-root-hash",
      "./routes/index.ts",
      "webpack://app/src#frag",
      "webpack://app/src/routes/index.ts",
    ],
    ["opaque-root", "#nitro/virtual/app", "virtual:", "virtual:#nitro/virtual/app"],
    ["opaque-ns-root", "#nitro/virtual/app", "virtual:ns", "virtual:ns/#nitro/virtual/app"],
    [
      "opaque-root-with-url",
      "a.ts",
      "virtual:proxy/https://example.com",
      "virtual:proxy/https://example.com/a.ts",
    ],
    ["null-byte-root", "a.ts", "\0virtual:", "\0virtual:a.ts"],
    [
      "whitespace-https-root",
      "a.ts",
      " https://cdn.example.com/src",
      "https://cdn.example.com/src/a.ts",
    ],
    ["tab-webpack-root", "a.ts", "\twebpack://app/src", "webpack://app/src/a.ts"],
    ["bare-drive-root", "a.ts", "C:", "C:/a.ts"],
    ["bare-drive-dot", "./a.ts", "C:", "C:/a.ts"],
    ["bare-drive-parent", "../a.ts", "C:", "C:/a.ts"],
    ["bare-drive-abs", "/app/a.ts", "C:", "C:/app/a.ts"],
    ["bare-drive-backslash", String.raw`sub\a.ts`, "C:", "C:/sub/a.ts"],
    ["bare-drive-foreign", "D:other.ts", "C:", "D:other.ts"],
    [
      "protocol-relative-https",
      "//cdn2.example.com/a.ts",
      "https://cdn.example.com/src",
      "https://cdn2.example.com/a.ts",
    ],
    [
      "win-abs-with-root",
      String.raw`C:\other\a.ts`,
      String.raw`C:\app\src`,
      String.raw`C:\other\a.ts`,
    ],
    [
      "win-unc-with-win-root",
      String.raw`\\server\share\a.ts`,
      String.raw`C:\app\src`,
      String.raw`\\server\share\a.ts`,
    ],
    [
      "win-unc-with-https-root",
      String.raw`\\server\share\a.ts`,
      "https://cdn.example.com/src",
      String.raw`\\server\share\a.ts`,
    ],
    ["win-root-relative", "../routes/index.ts", String.raw`C:\app\src`, "C:/app/routes/index.ts"],
    ["win-root-trailing-slash", "routes/index.ts", "C:\\app\\src\\", "C:/app/src/routes/index.ts"],
    ["win-root-double-slash", "index.ts", "C://app/src", "C:/app/src/index.ts"],
    [
      "win-root-special-chars",
      "100% #1.ts",
      String.raw`C:\app\my dir\src`,
      "C:/app/my dir/src/100% #1.ts",
    ],
    ["win-root-clamp", "../../../escape.ts", String.raw`C:\app\src`, "C:/escape.ts"],
    ["win-root-unc-slash", "//other/share/a.ts", String.raw`C:\app\src`, "//other/share/a.ts"],
    [
      "win-root-localhost-unc",
      "//localhost/share/a.ts",
      String.raw`C:\app\src`,
      "//localhost/share/a.ts",
    ],
    ["localhost-unc-source", "//localhost/share/a.ts", undefined, "//localhost/share/a.ts"],
    ["unc-root-relative", "../a.ts", String.raw`\\server\share\src`, "//server/share/a.ts"],
    [
      "unc-root-clamp",
      "../../escape.ts",
      String.raw`\\server\share\src`,
      "//server/share/escape.ts",
    ],
    ["unc-root-abs", "/abs.ts", String.raw`\\server\share\src`, "//server/share/abs.ts"],
    ["unc-share-root-clamp", "../escape.ts", "//server/share", "//server/share/escape.ts"],
    ["unc-root-special", "100% #1.ts", "//server/share/my dir", "//server/share/my dir/100% #1.ts"],
    ["unc-localhost-root", "a.ts", String.raw`\\localhost\share\src`, "//localhost/share/src/a.ts"],
    [
      "unc-mixed-slash-root",
      "a.ts",
      String.raw`/\localhost/share/src`,
      "//localhost/share/src/a.ts",
    ],
    [
      "unc-mixed-slash-win-root",
      String.raw`/\localhost/share/a.ts`,
      String.raw`C:\app\src`,
      String.raw`/\localhost/share/a.ts`,
    ],
    [
      "unc-mixed-slash-source",
      String.raw`/\localhost/share/a.ts`,
      undefined,
      String.raw`/\localhost/share/a.ts`,
    ],
    ["win-root-trailing-multi-slash", "a.ts", "C:\\app\\src\\\\", "C:/app/src/a.ts"],
    ["win-root-foreign-drive", "D:other.ts", String.raw`C:\app\src`, "D:other.ts"],
    ["invalid-file-url", "file:///tmp/a%2Fb.ts", undefined, "file:///tmp/a%2Fb.ts"],
    ["invalid-file-url-root", "a.ts", "file:///tmp/a%2Fb", "file:///tmp/a%2Fb/a.ts"],
    ["malformed-file-url-root", "a.ts", "file://[invalid]/dir", "file://[invalid]/dir/a.ts"],
  ])(
    "maps frames with non-file URL, virtual, or Windows sourceRoot (%s)",
    async (subdir, originalSource, sourceRoot, expectedFile) => {
      const { error, frame } = await mapWithCustomSourceMap(subdir, (map) => {
        map.sources = [originalSource];
        if (sourceRoot !== undefined) {
          map.sourceRoot = sourceRoot;
        }
      });

      expect(frame).toMatchObject({ file: expectedFile, line: 5, col: 3, type: "app", source });
      expect(error.stack).toContain(`${expectedFile}:5:3`);
      const codeFrame = await getCodeFrame(frame, { context: 0 });
      expect(codeFrame!.lines[0]).toContainEqual({ text: "throw", type: "kwd" });
    }
  );

  it("maps file:// URL and relative sourceRoot paths without double-escaping", async () => {
    const { mkdir } = await import("node:fs/promises");
    const spaceDir = join(dir, "my dir");
    const spaceFile = join(spaceDir, "src.ts");
    const expectedSpaceFile = fileURLToPath(pathToFileURL(spaceFile));
    await mkdir(spaceDir, { recursive: true });
    await writeFile(spaceFile, source);

    const direct = await mapWithCustomSourceMap("file-url-direct", (map) => {
      map.sources = [pathToFileURL(spaceFile).href];
      delete map.sourcesContent;
    });
    expect(direct.frame).toMatchObject({ file: expectedSpaceFile, line: 5, col: 3, type: "app" });
    const directCodeFrame = await getCodeFrame(direct.frame, { context: 0 });
    expect(directCodeFrame!.lines[0]).toContainEqual({ text: "throw", type: "kwd" });

    const withRoot = await mapWithCustomSourceMap("file-url-root", (map) => {
      map.sourceRoot = pathToFileURL(spaceDir).href;
      map.sources = ["src.ts"];
      delete map.sourcesContent;
    });
    expect(withRoot.frame).toMatchObject({
      file: expectedSpaceFile,
      line: 5,
      col: 3,
      type: "app",
    });
    const rootCodeFrame = await getCodeFrame(withRoot.frame, { context: 0 });
    expect(rootCodeFrame!.lines[0]).toContainEqual({ text: "throw", type: "kwd" });

    const withQueryRoot = await mapWithCustomSourceMap("file-url-query-root", (map) => {
      map.sourceRoot = `${pathToFileURL(spaceDir).href}?v=1#frag`;
      map.sources = ["src.ts"];
      delete map.sourcesContent;
    });
    expect(withQueryRoot.frame).toMatchObject({
      file: expectedSpaceFile,
      line: 5,
      col: 3,
      type: "app",
    });

    const withRelativeRoot = await mapWithCustomSourceMap("relative-root", (map) => {
      map.sourceRoot = "../my dir";
      map.sources = ["src.ts"];
      delete map.sourcesContent;
    });
    expect(withRelativeRoot.frame).toMatchObject({
      file: expectedSpaceFile,
      line: 5,
      col: 3,
      type: "app",
    });

    const withLeadingSpaceFileURL = await mapWithCustomSourceMap(
      "leading-space-file-url",
      (map) => {
        map.sourceRoot = String.raw`C:\app\src`;
        map.sources = [` ${pathToFileURL(spaceFile).href}`];
        delete map.sourcesContent;
      }
    );
    expect(withLeadingSpaceFileURL.frame).toMatchObject({
      file: expectedSpaceFile,
      line: 5,
      col: 3,
      type: "app",
    });

    const withLeadingSpaceFileRoot = await mapWithCustomSourceMap(
      "leading-space-file-root",
      (map) => {
        map.sourceRoot = ` ${pathToFileURL(spaceDir).href}`;
        map.sources = ["src.ts"];
        delete map.sourcesContent;
      }
    );
    expect(withLeadingSpaceFileRoot.frame).toMatchObject({
      file: expectedSpaceFile,
      line: 5,
      col: 3,
      type: "app",
    });
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
