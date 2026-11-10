import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { join } from "pathe";
import type { NitroOptions } from "nitro/types";
import { resolveServicesOptions } from "../../src/config/resolvers/services.ts";

const rootDir = fileURLToPath(new URL("../vite/plugin-options-fixture", import.meta.url));

function resolve(options: Partial<NitroOptions>) {
  const resolved = { rootDir, scanDirs: [], services: {}, ...options } as NitroOptions;
  resolveServicesOptions(resolved);
  return resolved.services;
}

describe("services config", () => {
  it("resolves path entries from the root dir", () => {
    expect(resolve({ services: { api: { entry: "./api-entry" } } })).toEqual({
      api: { entry: join(rootDir, "api-entry.ts") },
    });
  });

  it("leaves bare specifiers to the builder", () => {
    expect(resolve({ services: { api: { entry: "some-pkg/server" } } })).toEqual({
      api: { entry: "some-pkg/server" },
    });
  });

  // Merged by the builder integration after modules ran
  it("does not merge the `vite.services` alias", () => {
    const services = resolve({ vite: { services: { api: { entry: "./api-entry.ts" } } } });
    expect(services).toEqual({});
  });

  it("throws for a service without entry", () => {
    expect(() => resolve({ services: { api: {} as any } })).toThrow(
      "Service `api` must have an `entry`"
    );
  });
});
