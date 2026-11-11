import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "pathe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { scanAndSyncOptions, scanHandlers } from "../../src/scan.ts";
import type { Nitro, NitroConfig } from "nitro/types";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "nitro-scan-sync-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const file = (path: string) => join(dir, path);

function write(path: string) {
  mkdirSync(dirname(file(path)), { recursive: true });
  writeFileSync(file(path), "export default {}");
}

function remove(path: string) {
  rmSync(file(path));
}

function createNitro(options: Partial<NitroConfig> = {}) {
  return {
    options: {
      scanDirs: [dir],
      ignore: [],
      plugins: [],
      tasks: {},
      modules: [],
      ...options,
      experimental: { tasks: true, ...options.experimental },
    },
    logger: console,
    routing: { sync: () => {} },
  } as unknown as Nitro;
}

describe("scan: plugins sync", () => {
  it("adds scanned plugins in scan order after config plugins", async () => {
    write("plugins/b.ts");
    write("plugins/a.ts");
    const nitro = createNitro({ plugins: ["config"] });
    await scanAndSyncOptions(nitro);
    expect(nitro.options.plugins).toEqual(["config", file("plugins/a.ts"), file("plugins/b.ts")]);
  });

  it("keeps added plugins in scan order before module plugins", async () => {
    write("plugins/b.ts");
    write("plugins/d.ts");
    const nitro = createNitro({ plugins: ["config"] });
    await scanAndSyncOptions(nitro);
    nitro.options.plugins.push("module");

    write("plugins/c.ts");
    write("plugins/a.ts");
    write("plugins/e.ts");
    await scanHandlers(nitro);
    expect(nitro.options.plugins).toEqual([
      "config",
      ...["a", "b", "c", "d", "e"].map((name) => file(`plugins/${name}.ts`)),
      "module",
    ]);
  });

  it("appends a plugin when no other scanned plugin is registered", async () => {
    const nitro = createNitro({ plugins: ["config"] });
    await scanAndSyncOptions(nitro);
    nitro.options.plugins.push("module");

    write("plugins/a.ts");
    await scanHandlers(nitro);
    expect(nitro.options.plugins).toEqual(["config", "module", file("plugins/a.ts")]);
  });

  it("removes deleted plugins and restores them in place when re-added", async () => {
    write("plugins/a.ts");
    write("plugins/b.ts");
    const nitro = createNitro({ plugins: ["config"] });
    await scanAndSyncOptions(nitro);
    nitro.options.plugins.push("module");
    const initial = [...nitro.options.plugins];

    remove("plugins/a.ts");
    await scanHandlers(nitro);
    expect(nitro.options.plugins).toEqual(["config", file("plugins/b.ts"), "module"]);

    write("plugins/a.ts");
    await scanHandlers(nitro);
    expect(nitro.options.plugins).toEqual(initial);

    remove("plugins/a.ts");
    remove("plugins/b.ts");
    await scanHandlers(nitro);
    expect(nitro.options.plugins).toEqual(["config", "module"]);
  });

  it("does not re-add a scanned plugin removed by a module", async () => {
    write("plugins/a.ts");
    write("plugins/b.ts");
    const nitro = createNitro();
    await scanAndSyncOptions(nitro);
    nitro.options.plugins = nitro.options.plugins.filter((p) => p !== file("plugins/a.ts"));

    write("plugins/c.ts");
    await scanHandlers(nitro);
    expect(nitro.options.plugins).toEqual([file("plugins/b.ts"), file("plugins/c.ts")]);
  });

  it("leaves plugins from config alone", async () => {
    write("plugins/a.ts");
    const nitro = createNitro({ plugins: [file("plugins/a.ts"), "config"] });
    await scanAndSyncOptions(nitro);
    expect(nitro.options.plugins).toEqual([file("plugins/a.ts"), "config"]);

    remove("plugins/a.ts");
    await scanHandlers(nitro);
    expect(nitro.options.plugins).toEqual([file("plugins/a.ts"), "config"]);
  });
});

describe("scan: tasks sync", () => {
  it("adds, removes and re-adds scanned tasks", async () => {
    write("tasks/a.ts");
    write("tasks/db/migrate.ts");
    const nitro = createNitro({ tasks: { config: { handler: "config" } } });
    await scanAndSyncOptions(nitro);
    expect(nitro.options.tasks).toEqual({
      config: { handler: "config" },
      a: { handler: file("tasks/a.ts"), description: "" },
      "db:migrate": { handler: file("tasks/db/migrate.ts"), description: "" },
    });

    remove("tasks/a.ts");
    await scanHandlers(nitro);
    expect(Object.keys(nitro.options.tasks)).toEqual(["config", "db:migrate"]);

    write("tasks/a.ts");
    write("tasks/b.ts");
    await scanHandlers(nitro);
    expect(nitro.options.tasks.a).toEqual({ handler: file("tasks/a.ts"), description: "" });
    expect(nitro.options.tasks.b).toEqual({ handler: file("tasks/b.ts"), description: "" });
  });

  it("does nothing without `experimental.tasks`", async () => {
    write("tasks/a.ts");
    const nitro = createNitro({ experimental: { tasks: false } });
    await scanAndSyncOptions(nitro);
    await scanHandlers(nitro);
    expect(nitro.options.tasks).toEqual({});
  });

  it("leaves config tasks with a handler alone", async () => {
    write("tasks/a.ts");
    const nitro = createNitro({ tasks: { a: { handler: "config" } } });
    await scanAndSyncOptions(nitro);
    expect(nitro.options.tasks).toEqual({ a: { handler: "config" } });

    remove("tasks/a.ts");
    await scanHandlers(nitro);
    expect(nitro.options.tasks).toEqual({ a: { handler: "config" } });
  });

  it("only fills and removes the handler of config tasks without one", async () => {
    write("tasks/a.ts");
    const nitro = createNitro({ tasks: { a: { description: "config" } } });
    await scanAndSyncOptions(nitro);
    expect(nitro.options.tasks).toEqual({
      a: { description: "config", handler: file("tasks/a.ts") },
    });

    remove("tasks/a.ts");
    await scanHandlers(nitro);
    expect(nitro.options.tasks).toEqual({ a: { description: "config" } });

    write("tasks/a.ts");
    await scanHandlers(nitro);
    expect(nitro.options.tasks).toEqual({
      a: { description: "config", handler: file("tasks/a.ts") },
    });
  });

  it("keeps scanned tasks changed by a module", async () => {
    write("tasks/a.ts");
    write("tasks/b.ts");
    const nitro = createNitro();
    await scanAndSyncOptions(nitro);
    nitro.options.tasks.a.description = "module";

    remove("tasks/a.ts");
    remove("tasks/b.ts");
    await scanHandlers(nitro);
    expect(nitro.options.tasks).toEqual({ a: { description: "module" } });
  });

  it("does not re-add a scanned task removed by a module", async () => {
    write("tasks/a.ts");
    const nitro = createNitro();
    await scanAndSyncOptions(nitro);
    delete nitro.options.tasks.a;

    write("tasks/b.ts");
    await scanHandlers(nitro);
    expect(Object.keys(nitro.options.tasks)).toEqual(["b"]);
  });

  it("falls back to the same task of another scan dir", async () => {
    write("layer/tasks/a.ts");
    write("tasks/a.ts");
    const nitro = createNitro({ scanDirs: [dir, join(dir, "layer")] });
    await scanAndSyncOptions(nitro);
    expect(nitro.options.tasks.a.handler).toBe(file("tasks/a.ts"));

    remove("tasks/a.ts");
    await scanHandlers(nitro);
    expect(nitro.options.tasks).toEqual({
      a: { handler: file("layer/tasks/a.ts"), description: "" },
    });

    remove("layer/tasks/a.ts");
    await scanHandlers(nitro);
    expect(nitro.options.tasks).toEqual({});
  });

  it("does not treat inherited keys as existing tasks", async () => {
    write("tasks/constructor.ts");
    const nitro = createNitro();
    await scanAndSyncOptions(nitro);
    expect(Object.hasOwn(nitro.options.tasks, "constructor")).toBe(true);
    expect(nitro.options.tasks.constructor).toEqual({
      handler: file("tasks/constructor.ts"),
      description: "",
    });
    expect(Object.hasOwn(Object, "handler")).toBe(false);

    remove("tasks/constructor.ts");
    await scanHandlers(nitro);
    expect(Object.hasOwn(nitro.options.tasks, "constructor")).toBe(false);
    expect(Object.hasOwn(Object, "handler")).toBe(false);
  });
});
