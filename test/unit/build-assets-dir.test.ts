import { describe, expect, it } from "vitest";
import { loadOptions } from "../../src/config/loader.ts";

describe("config: buildAssetsDir", () => {
  it.each([
    ["assets", "assets"],
    ["/assets/", "assets"],
    ["//_vercel//immutable//", "_vercel/immutable"],
    ["./assets", "assets"],
    ["_vercel/immutable/../../etc/nitro", "_vercel/immutable/etc/nitro"],
  ])("normalizes %j to %j", async (input, expected) => {
    const options = await loadOptions({ buildAssetsDir: input });
    expect(options.buildAssetsDir).toBe(expected);
  });

  it.each(["/", "", "."])("is unset when nothing meaningful is left (%j)", async (input) => {
    const options = await loadOptions({ buildAssetsDir: input });
    expect(options.buildAssetsDir).toBeUndefined();
  });
});
