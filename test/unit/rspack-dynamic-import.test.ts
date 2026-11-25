import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { execa } from "execa";
import { getRandomPort } from "get-port-please";
import { dirname, join } from "pathe";
import { afterAll, describe, expect, it } from "vitest";
import { build, createNitro, prepare } from "../../src/builder.ts";
import { waitForServer } from "../presets/_wait-for-server.ts";

// Real Rspack builds, run by the `rspack` CI job (not by `pnpm test`)
const isRspack = process.env.NITRO_BUILDER === "rspack";

const tmpDirs: string[] = [];
afterAll(() => {
  for (const dir of tmpDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function createApp(files: Record<string, string>) {
  const rootDir = mkdtempSync(join(tmpdir(), "nitro-rspack-dynamic-import-"));
  tmpDirs.push(rootDir);
  for (const [path, contents] of Object.entries({
    "package.json": JSON.stringify({ type: "module" }),
    ...files,
  })) {
    mkdirSync(dirname(join(rootDir, path)), { recursive: true });
    writeFileSync(join(rootDir, path), contents);
  }
  return rootDir;
}

function serverSource(serverDir: string) {
  return readdirSync(serverDir, { recursive: true })
    .map((name) => join(serverDir, String(name)))
    .filter((path) => path.endsWith(".mjs") || path.endsWith(".js"))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
}

describe.skipIf(!isRspack)("rspack: non-literal dynamic import", () => {
  it("keeps unknown import() native and still bundles literal import()", async () => {
    const rootDir = createApp({
      // Not part of the bundle. Loaded at runtime by a non-literal import.
      "plugin.mjs": `export default "loaded plugin.mjs";\n`,
      "server/locales/en.mjs": `export default "en";\n`,
      "server/lib/some-local-chunk.ts": `export default "local chunk";\n`,
      "lazy-handler.ts": `export default () => "lazy handler";\n`,
      "server/routes/index.ts": `
        import { join } from "node:path";
        import { pathToFileURL } from "node:url";

        export default async () => {
          const file = join(process.cwd(), "plugin.mjs");
          const mod = await import(pathToFileURL(file).href);
          return mod.default;
        };
      `,
      "server/routes/url.ts": `
        export default async (event) => {
          const url = event.url.searchParams.get("url");
          const mod = await import(url);
          return mod.default;
        };
      `,
      "server/routes/chunk.ts": `
        export default async () => {
          const mod = await import("../lib/some-local-chunk.ts");
          return mod.default;
        };
      `,
      "server/routes/locales.ts": `
        export default async (event) => {
          const lang = event.url.searchParams.get("lang");
          const mod = await import(\`../locales/\${lang}.mjs\`);
          return mod.default;
        };
      `,
    });
    const pluginUrl = pathToFileURL(join(rootDir, "plugin.mjs")).href;
    const nitro = await createNitro({
      rootDir,
      serverDir: "./server",
      builder: "rspack",
      preset: "node",
      compatibilityDate: "latest",
      logLevel: 0,
      sourcemap: false,
      handlers: [{ route: "/lazy", handler: join(rootDir, "lazy-handler.ts"), lazy: true }],
    });
    try {
      await prepare(nitro);
      await build(nitro);
    } finally {
      await nitro.close();
    }

    const serverDir = nitro.options.output.serverDir;
    const port = await getRandomPort();
    const child = execa(process.execPath, [join(serverDir, "index.mjs")], {
      cwd: rootDir,
      env: { ...process.env, NITRO_PORT: String(port), NITRO_HOST: "127.0.0.1" },
      reject: false,
    });
    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    try {
      await waitForServer(`http://127.0.0.1:${port}/`, child.nodeChildProcess!);
      const index = await fetch(`http://127.0.0.1:${port}/`);
      const indexBody = await index.text();
      expect(index.status, `${indexBody}\n${stderr}`).toBe(200);
      expect(indexBody).toBe("loaded plugin.mjs");

      const byUrl = await fetch(
        `http://127.0.0.1:${port}/url?url=${encodeURIComponent(pluginUrl)}`
      );
      const byUrlBody = await byUrl.text();
      expect(byUrl.status, byUrlBody).toBe(200);
      expect(byUrlBody).toBe("loaded plugin.mjs");

      const chunk = await fetch(`http://127.0.0.1:${port}/chunk`);
      const chunkBody = await chunk.text();
      expect(chunk.status, chunkBody).toBe(200);
      expect(chunkBody).toBe("local chunk");

      const lazy = await fetch(`http://127.0.0.1:${port}/lazy`);
      const lazyBody = await lazy.text();
      expect(lazy.status, lazyBody).toBe(200);
      expect(lazyBody).toBe("lazy handler");
    } finally {
      child.kill("SIGKILL");
    }

    const source = serverSource(serverDir);
    const files = readdirSync(serverDir, { recursive: true }).map(String);
    // Literal imports are split into chunks. A template import is a context request in Rspack
    // and a native import in rolldown, so it must not be rewritten into `__rspack_async_context`.
    expect(files.join("\n")).toMatch(/some-local-chunk/);
    expect(files.join("\n")).toMatch(/lazy/);
    expect(source).toContain("local chunk");
    expect(source).toContain("lazy handler");
    expect(source).not.toContain("__rspack_empty_async_context");
    expect(source).not.toContain("__rspack_async_context");
    expect(source).toMatch(/import\([\s\S]*?pathToFileURL[\s\S]*?\.href\)/);
    expect(source).toMatch(/import\(\s*`[^`]*locales\/\$\{lang\}\.mjs`\s*\)/);
    expect(source).toMatch(/import\(\s*url\s*\)/);
  }, 40_000);
});
