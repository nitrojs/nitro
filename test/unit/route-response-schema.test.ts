import { describe, expect, it, vi } from "vitest";

const deps = vi.hoisted(() => ({
  ensureDep: vi.fn(),
  isDepInstalled: vi.fn(() => false),
}));

vi.mock("../../src/utils/dep.ts", () => deps);

const { createRouteResponseSchemaGenerator } =
  await import("../../src/build/plugins/_route-response-schema.ts");

describe("route response schemas", () => {
  it("warns once and skips inference without TypeScript", async () => {
    const warn = vi.fn();
    const generator = createRouteResponseSchemaGenerator({
      routing: { routes: { routes: {} } },
      options: { rootDir: "/test/project" },
      logger: { debug: vi.fn(), warn },
    } as any);

    await generator.infer("route.ts");
    await generator.infer("route.ts");

    expect(warn).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"typescript" is not installed'));
    expect(deps.ensureDep).not.toHaveBeenCalled();
  });
});
