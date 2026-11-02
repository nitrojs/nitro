import { describe, expect, it } from "vitest";
import { findArgsError } from "../../src/cli/commands/create/_args.ts";

const argsDef = {
  dir: { type: "positional", required: false },
  template: { type: "string", alias: "t" },
  force: { type: "boolean" },
  install: { type: "boolean", default: true },
  gitInit: { type: "boolean" },
} as const;

const choices = { template: ["vite", "rolldown"] };

describe("findArgsError", () => {
  it.each([
    [["my-app"]],
    [["my-app", "-t", "vite", "--force"]],
    [["my-app", "--template=vite", "--no-install", "--git-init"]],
    [["--gitInit", "--force=false", "--", "my-app"]],
  ])("accepts %j", (rawArgs) => {
    expect(findArgsError(rawArgs, argsDef, { choices })).toBeUndefined();
  });

  it.each([
    [["my-app", "--yes"], "Unknown option `--yes`. Run"],
    [["my-app", "--git"], "Did you mean `--gitInit`?"],
    [["my-app", "--templates", "vite"], "Did you mean `--template`?"],
    [["my-app", "--tempalte", "vite"], "Did you mean `--template`?"],
    [["my-app", "--force", "false"], "Use `--force` or `--no-force` instead."],
    [["my-app", "-t"], "Missing value for `-t`. Use one of: vite, rolldown."],
    [["my-app", "-t", "--force"], "Missing value for `-t`."],
    [["my-app", "--template="], "Missing value for `--template`."],
    [["my-app", "other"], "Unexpected argument `other`."],
  ])("rejects %j", (rawArgs, message) => {
    expect(findArgsError(rawArgs, argsDef, { choices })).toContain(message);
  });
});
