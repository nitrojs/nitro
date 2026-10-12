import { describe, expect, it, vi } from "vitest";
import { externals, sameFilePath } from "../../src/rollup/plugins/externals";

const windowsModule = "C:\\project\\node_modules\\pinia\\dist\\pinia.js";

vi.mock("exsolve", () => ({
  resolveModuleURL: vi.fn((id: string) => {
    if (id === "pinia") {
      return "C:\\project\\node_modules\\pinia\\index.js";
    }
    if (id === "pinia/dist/pinia.js" || id === windowsModule) {
      return windowsModule;
    }
  }),
}));

vi.mock("mlly", async (importOriginal) => {
  const actual = await importOriginal<typeof import("mlly")>();
  return {
    ...actual,
    isValidNodeImport: vi.fn(async () => true),
    lookupNodeModuleSubpath: vi.fn(async () => "dist/pinia.js"),
    parseNodeModulePath: vi.fn(() => ({ name: "pinia" })),
  };
});

describe("externals: Windows path comparisons", () => {
  it("matches paths with different Windows separators", () => {
    expect(
      sameFilePath(
        "C:\\project\\node_modules\\pinia\\dist\\pinia.js",
        "C:/project/node_modules/pinia/dist/pinia.js"
      )
    ).toBe(true);
  });

  it("does not match different files", () => {
    expect(
      sameFilePath(
        "C:\\project\\node_modules\\pinia\\dist\\pinia.js",
        "C:/project/node_modules/pinia/dist/index.js"
      )
    ).toBe(false);
  });

  it("does not match an unresolved path", () => {
    expect(
      sameFilePath(undefined, "C:/project/node_modules/pinia/index.js")
    ).toBe(false);
  });

  it("externalizes the package subpath when resolver paths use backslashes", async () => {
    const plugin = externals({ moduleDirectories: [], trace: true } as never);
    const hook = plugin.resolveId;
    const handler = typeof hook === "function" ? hook : hook?.handler;
    if (!handler) {
      throw new Error("Expected the externals plugin to expose resolveId");
    }
    const result = await handler.call(
      {
        resolve: async () => ({ id: windowsModule }),
      } as never,
      windowsModule,
      "C:\\project\\server\\index.js",
      {} as never
    );

    expect(result).toEqual({ id: "pinia/dist/pinia.js", external: true });
  });
});
