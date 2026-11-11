import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "pathe";

export type Fetch = (path: string) => Promise<Response>;

export interface ScanDirCase {
  dir: string;
  files: Record<string, string>;
  file: string;
  contents: string;
  observe: (fetch: Fetch) => Promise<unknown>;
  added: unknown;
  removed: unknown;
}

const index = { "routes/index.ts": `export default () => "index";` };

/** Files added to, removed from and re-added to each scan dir during dev. */
export const scanDirCases: ScanDirCase[] = [
  {
    dir: "routes",
    files: index,
    file: "routes/added.ts",
    contents: `export default () => "added";`,
    observe: async (fetch) => [await text(await fetch("/")), await text(await fetch("/added"))],
    added: ["index", "added"],
    removed: ["index", 404],
  },
  {
    dir: "api",
    files: index,
    file: "api/added.ts",
    contents: `export default () => "added";`,
    observe: async (fetch) => [await text(await fetch("/")), await text(await fetch("/api/added"))],
    added: ["index", "added"],
    removed: ["index", 404],
  },
  {
    dir: "middleware",
    files: index,
    file: "middleware/added.ts",
    contents: `export default (event) => { event.res.headers.set("x-middleware", "added"); };`,
    observe: async (fetch) => {
      const res = await fetch("/");
      return [await text(res), res.headers.get("x-middleware")];
    },
    added: ["index", "added"],
    removed: ["index", null],
  },
  {
    dir: "plugins",
    files: { ...index, "plugins/base.ts": plugin("base") },
    file: "plugins/added.ts",
    contents: plugin("added"),
    observe: async (fetch) => {
      const res = await fetch("/");
      return [await text(res), res.headers.get("x-plugins")];
    },
    added: ["index", "added, base"],
    removed: ["index", "base"],
  },
  {
    dir: "tasks",
    files: { "tasks/base.ts": task("base") },
    file: "tasks/added.ts",
    contents: task("added"),
    observe: async (fetch) => {
      const list = await fetch("/_nitro/tasks");
      const run = await fetch("/_nitro/tasks/added");
      return [
        list.ok ? ((await list.json()) as { tasks: unknown }).tasks : list.status,
        run.ok ? await run.json() : run.status,
      ];
    },
    added: [
      { base: { description: "base" }, added: { description: "added" } },
      { result: "added" },
    ],
    removed: [{ base: { description: "base" } }, 404],
  },
];

export function writeFiles(rootDir: string, files: Record<string, string>) {
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(rootDir, path)), { recursive: true });
    writeFileSync(join(rootDir, path), contents);
  }
}

/** A public asset that exists at startup and is deleted during dev. */
export const publicAssetCase = {
  files: {
    "public/asset.txt": "asset",
    "routes/internal.ts": `import { serverFetch } from "nitro";
export default () => serverFetch("/asset.txt");`,
  },
  file: "public/asset.txt",
  observe: async (fetch: Fetch) => [
    await text(await fetch("/asset.txt")),
    await text(await fetch("/internal")),
  ],
  existing: ["asset", "asset"],
  removed: [404, 404],
};

async function text(res: Response) {
  return res.ok ? await res.text() : res.status;
}

function plugin(name: string) {
  return `export default (nitroApp) => {
  nitroApp.hooks.hook("response", (res) => { res.headers.append("x-plugins", "${name}"); });
};`;
}

function task(name: string) {
  return `export default { meta: { description: "${name}" }, run: () => ({ result: "${name}" }) };`;
}
