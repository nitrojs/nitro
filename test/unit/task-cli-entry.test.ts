import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import { join, resolve } from "pathe";
import { build, createNitro, prepare } from "nitro/builder";
import { afterAll, describe, expect, it } from "vitest";

const entries = [
  ["no default export", ""],
  ["default without fetch", "export default { port: 3999 };"],
  ["named default without fetch", "const options = { port: 3999 }; export { options as default };"],
] as const;
const builders = [
  ["rollup", false],
  ["rolldown", false],
  ["vite", true],
  ["vite", false],
] as const;
const scratch = fileURLToPath(new URL("../.tmp/task-cli-entry/", import.meta.url));
const cleanups: string[] = [];

describe("task CLI server entry compatibility", () => {
  afterAll(async () => {
    for (const dir of cleanups.splice(0)) await rm(dir, { recursive: true, force: true });
    await rm(scratch, { recursive: true, force: true });
  });

  for (const [name, entry] of entries) {
    it.each(builders)(
      `preserves ${name} with %s (Vite7=%s)`,
      async (builder, vite7) => {
        const fixture = await createFixture(name, entry);
        const nitro = await createNitro({
          rootDir: fixture.source,
          serverDir: "./",
          preset: "node-server",
          builder,
          buildDir: join(fixture.base, ".nitro"),
          output: { dir: fixture.output },
          experimental: { tasks: true, taskCLI: true },
          ...(vite7 ? { vite: { path: resolve("node_modules/vite7") } } : {}),
          logLevel: 0,
        });
        try {
          await prepare(nitro);
          await build(nitro);
        } finally {
          await nitro.close();
        }
        const info = JSON.parse(await readFile(join(fixture.output, "nitro.json"), "utf8"));
        expect(info.taskEntry).toBe("tasks/index.mjs");
        await rm(fixture.source, { recursive: true, force: true });
        await rm(join(fixture.base, ".nitro"), { recursive: true, force: true });
        const run = (args: string[]) =>
          execa(process.execPath, [join(fixture.output, info.taskEntry), ...args], {
            cwd: fixture.cwd,
            env: { TASK_CLI_ENTRY_EVENTS: fixture.events },
            reject: false,
            timeout: 10_000,
          });
        const help = await run(["--help"]);
        expect(help.exitCode, help.stderr).toBe(0);
        expect(help.stdout).toContain("Usage:");
        const list = await run(["list"]);
        expect(list.exitCode, list.stderr).toBe(0);
        expect(JSON.parse(list.stdout)).toEqual([
          { name: "echo", description: "", implemented: true },
        ]);
        expect(existsSync(fixture.events)).toBe(false);
        const result = await run(["run", "echo", "--payload", '{"id":7}']);
        expect(result.exitCode, result.stderr).toBe(0);
        expect(result.signal).toBeUndefined();
        expect(JSON.parse(result.stdout)).toEqual({
          result: { startup: name, payload: { id: 7 } },
        });
        expect((await readFile(fixture.events, "utf8")).split("\n").filter(Boolean)).toEqual([
          "startup",
          "init",
          "close",
        ]);
      },
      60_000
    );
  }

  it.each(["rollup", "rolldown"] as const)(
    "does not emit a task sidecar from an opted-in %s dev build",
    async (builder) => {
      const fixture = await createFixture("dev", "");
      const nitro = await createNitro({
        rootDir: fixture.source,
        serverDir: "./",
        dev: true,
        builder,
        buildDir: join(fixture.base, ".nitro"),
        output: { dir: fixture.output },
        experimental: { tasks: true, taskCLI: true },
        logLevel: 0,
      });
      let timer: ReturnType<typeof setTimeout> | undefined;
      const ready = new Promise<void>((resolve, reject) => {
        nitro.hooks.hookOnce("dev:reload", () => resolve());
        nitro.hooks.hookOnce("dev:error", (error) => reject(error));
        timer = setTimeout(() => reject(new Error("Dev fixture did not compile")), 15_000);
      });
      void ready.catch(() => {});
      try {
        await prepare(nitro);
        await build(nitro);
        await ready;
        expect(nitro.options.experimental.taskCLI).toBe(true);
        expect(existsSync(join(nitro.options.output.serverDir, "index.mjs"))).toBe(true);
        expect(existsSync(join(fixture.output, "tasks/index.mjs"))).toBe(false);
        expect(existsSync(join(fixture.output, "nitro.json"))).toBe(false);
        expect(existsSync(fixture.events)).toBe(false);
      } finally {
        clearTimeout(timer);
        await nitro.close();
      }
    },
    60_000
  );
});

async function createFixture(name: string, entry: string) {
  const base = await mkdtemp(join(tmpdir(), "nitro-task-entry-"));
  await mkdir(scratch, { recursive: true });
  const source = await mkdtemp(join(scratch, "source-"));
  cleanups.push(base, source);
  const cwd = join(base, "unrelated cwd");
  await mkdir(cwd);
  await mkdir(join(source, "plugins"));
  await mkdir(join(source, "tasks"));
  await writeFile(join(source, "vite.config.ts"), "export default {};\n");
  await writeFile(
    join(source, "server.ts"),
    `import { appendFileSync } from "node:fs";
globalThis.__taskCLIEntryStarted = ${JSON.stringify(name)};
appendFileSync(process.env.TASK_CLI_ENTRY_EVENTS, "startup\\n");
${entry}\n`
  );
  await writeFile(
    join(source, "plugins/close.ts"),
    `import { appendFileSync } from "node:fs";
export default (app) => {
  appendFileSync(process.env.TASK_CLI_ENTRY_EVENTS, "init\\n");
  app.hooks.hook("close", () => appendFileSync(process.env.TASK_CLI_ENTRY_EVENTS, "close\\n"));
};\n`
  );
  await writeFile(
    join(source, "tasks/echo.ts"),
    `export default { run: ({ payload }) => ({ result: { startup: globalThis.__taskCLIEntryStarted, payload } }) };\n`
  );
  return { base, source, cwd, output: join(base, "output"), events: join(base, "events.txt") };
}
