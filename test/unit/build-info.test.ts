import { describe, expect, it, vi } from "vitest";

vi.mock("nitro/meta", () => ({ version: "0.0.0" }));
vi.mock("nitro/types", () => ({}));

import { resolveNitroServerEntryFileName } from "../../src/build/info.ts";

describe("resolveNitroServerEntryFileName", () => {
  it("returns undefined when there are no entry chunks", () => {
    expect(resolveNitroServerEntryFileName({ output: [] })).toBeUndefined();
  });

  it("returns the only entry chunk", () => {
    expect(
      resolveNitroServerEntryFileName({
        output: [{ type: "chunk", isEntry: true, fileName: "server/index.mjs" }],
      })
    ).toBe("server/index.mjs");
  });

  it("prefers index.mjs when Module Federation adds extra entry chunks", () => {
    expect(
      resolveNitroServerEntryFileName({
        output: [
          { type: "chunk", isEntry: true, fileName: "App.expose.mjs" },
          { type: "chunk", isEntry: true, fileName: "server/index.mjs" },
        ],
      })
    ).toBe("server/index.mjs");
  });

  it("falls back to first entry when no index.mjs is present", () => {
    expect(
      resolveNitroServerEntryFileName({
        output: [
          { type: "chunk", isEntry: true, fileName: "App.expose.mjs" },
          { type: "chunk", isEntry: true, fileName: "Other.expose.mjs" },
        ],
      })
    ).toBe("App.expose.mjs");
  });

  it("ignores non-entry chunks", () => {
    expect(
      resolveNitroServerEntryFileName({
        output: [
          { type: "chunk", isEntry: false, fileName: "shared.mjs" },
          { type: "chunk", isEntry: true, fileName: "server/index.mjs" },
        ],
      })
    ).toBe("server/index.mjs");
  });
});
