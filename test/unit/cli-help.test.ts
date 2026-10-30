import { fileURLToPath } from "node:url";
import { execa } from "execa";
import { describe, expect, it } from "vitest";

const cli = fileURLToPath(new URL("../../dist/cli/index.mjs", import.meta.url));

// Prints the URL of every module the process loads, on exit
const logLoads = `data:text/javascript,${encodeURIComponent(`
import { registerHooks } from "node:module";
const urls = [];
registerHooks({ load: (url, context, next) => (urls.push(url), next(url, context)) });
process.on("exit", () => process.stderr.write(JSON.stringify(urls)));
`)}`;

// Help and version output only need the command definitions, not the builder
describe("nitro CLI help", () => {
  it.each([
    "--help",
    "--version",
    "build --help",
    "dev --help",
    "task run --help",
    "create --help",
  ])("`nitro %s` doesn't load the builder", async (command) => {
    const { exitCode, stderr } = await execa(
      "node",
      ["--import", logLoads, cli, ...command.split(" ")],
      { reject: false }
    );
    expect(exitCode).toBe(0);
    const loaded: string[] = JSON.parse(stderr);
    expect(loaded.some((url) => url.endsWith("/dist/cli/index.mjs"))).toBe(true);
    expect(loaded.filter((url) => /\/dist\/(builder|_build\/common)\.mjs$/.test(url))).toEqual([]);
  });
});
