import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterAll, expect, it } from "vitest";
import { scanAndSyncOptions, scanHandlers } from "../../src/scan.ts";
import type { Nitro } from "nitro/types";

const dir = mkdtempSync(join(tmpdir(), "nitro-scan-plugins-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const plugin = (name: string) => join(dir, "plugins", name);
const write = (name: string) => writeFileSync(plugin(name), "export default {}");
const rel = (plugins: string[]) => plugins.map((p) => p.replace(`${dir}/`, ""));

it("syncs scanned plugins on rescan", async () => {
  mkdirSync(join(dir, "plugins"));
  for (const name of ["a.ts", "b.ts", "c.ts", "m.ts"]) {
    write(name);
  }
  const nitro = {
    options: {
      scanDirs: [dir],
      ignore: [],
      plugins: ["#config", plugin("c.ts")],
      experimental: {},
    },
    logger: console,
    routing: { sync: () => {} },
  } as unknown as Nitro;

  await scanAndSyncOptions(nitro);
  nitro.options.plugins = nitro.options.plugins.filter((p) => p !== plugin("m.ts"));
  nitro.options.plugins.push("#module");

  rmSync(plugin("a.ts"));
  rmSync(plugin("c.ts"));
  write("00.init.ts");
  write("d.ts");
  await scanHandlers(nitro);

  expect(rel(nitro.options.plugins)).toEqual([
    "#config",
    "plugins/c.ts",
    "plugins/00.init.ts",
    "plugins/b.ts",
    "#module",
    "plugins/d.ts",
  ]);
});
