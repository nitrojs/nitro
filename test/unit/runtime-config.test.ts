import { describe, expect, it, vi } from "vitest";
import { normalizeRuntimeConfig } from "../../src/core/config/resolvers/runtime-config";
import type { NitroConfig } from "nitropack/types";

const defaultRuntimeConfig = {
  textProperty: "value",
  numberProperty: 42,
  booleanProperty: true,
  arrayProperty: ["A", "B", "C"],
  objectProperty: {
    innerProperty: "value",
  },
  mixedArrayProperty: [
    "A",
    "B",
    {
      inner: {
        innerProperty: "value",
      },
    },
  ],
};

const nitroConfig: NitroConfig = {
  runtimeConfig: defaultRuntimeConfig,
  baseURL: "https://example.com",
  experimental: {
    envExpansion: false,
  },
};

describe("normalizeRuntimeConfig", () => {
  it("should not warn on a serializable runtime config", () => {
    const warnSpy = vi.spyOn(console, "warn");
    normalizeRuntimeConfig(nitroConfig);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("should not warn when primitive prototype is changed", () => {
    const warnSpy = vi.spyOn(console, "warn");

    (String.prototype as any).brokenFunction = () => undefined;

    normalizeRuntimeConfig(nitroConfig);
    expect(warnSpy).not.toHaveBeenCalled();

    delete (String.prototype as any).brokenFunction;
  });

  it("should throw a warning when runtimeConfig is not serializable", () => {
    const warnSpy = vi.spyOn(console, "warn");
    normalizeRuntimeConfig({
      ...nitroConfig,
      runtimeConfig: {
        ...defaultRuntimeConfig,
        brokenProperty: new Map(),
      },
    });
    expect(warnSpy).toHaveBeenCalled();
  });
});
