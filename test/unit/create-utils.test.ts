import { describe, expect, it } from "vitest";
import { shellQuote } from "../../src/cli/commands/create/_utils.ts";

describe.skipIf(process.platform === "win32")("shellQuote", () => {
  it.each([
    ["my-app", "my-app"],
    ["../deep/my_app.v2", "../deep/my_app.v2"],
    ["my app", "'my app'"],
    ["it's $HOME", `'it'\\''s $HOME'`],
  ])("quotes %j", (path, quoted) => {
    expect(shellQuote(path)).toBe(quoted);
  });
});
