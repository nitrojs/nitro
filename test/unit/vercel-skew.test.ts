import { describe, expect, it } from "vitest";
import { generateBuildConfig } from "../../src/presets/vercel/utils.ts";
import type { Nitro } from "nitro/types";

function mockNitro(overrides: {
  skewProtection?: boolean;
  deploymentId?: string;
  baseURL?: string;
}): Nitro {
  return {
    options: {
      routeRules: {},
      publicAssets: [],
      baseURL: overrides.baseURL ?? "/",
      framework: { name: "nitro", version: "3.x" },
      static: false,
      experimental: {},
      scheduledTasks: {},
      vercel: {
        skewProtection: overrides.skewProtection ?? false,
      },
      manifest: {
        deploymentId: overrides.deploymentId,
      },
    },
    _prerenderedRoutes: [],
  } as unknown as Nitro;
}

describe("vercel skew protection cookie", () => {
  it("emits __vdpl with SameSite=Lax when skew protection is enabled", () => {
    const config = generateBuildConfig(
      mockNitro({ skewProtection: true, deploymentId: "dpl_test123" })
    );
    const skewRoute = config.routes?.find((r: any) =>
      r.headers?.["Set-Cookie"]?.includes("__vdpl=")
    );
    expect(skewRoute).toBeTruthy();
    expect(skewRoute!.headers!["Set-Cookie"]).toBe(
      "__vdpl=dpl_test123; Path=/; SameSite=Lax; Secure; HttpOnly"
    );
    expect(skewRoute!.headers!["Set-Cookie"]).not.toContain("SameSite=Strict");
  });

  it("does not emit __vdpl route when skew protection is off", () => {
    const config = generateBuildConfig(mockNitro({ skewProtection: false }));
    const skewRoute = config.routes?.find((r: any) =>
      r.headers?.["Set-Cookie"]?.includes("__vdpl=")
    );
    expect(skewRoute).toBeUndefined();
  });
});
