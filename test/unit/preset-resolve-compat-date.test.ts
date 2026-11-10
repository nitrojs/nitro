import { describe, expect, it, vi } from "vitest";
import { resolvePreset } from "../../src/presets/_resolve.ts";

vi.mock("../../src/presets/_all.gen.ts", () => ({
  default: [
    { _meta: { name: "demo" } },
    {
      _meta: {
        name: "demo-next",
        stdName: "vercel",
        aliases: ["demo"],
        compatibilityDate: "2025-06-01",
      },
    },
    { _meta: { name: "gated", compatibilityDate: "2025-06-01" } },
  ],
}));

describe("resolvePreset compatibilityDate", () => {
  it("picks the newest variant allowed by the compatibility date", async () => {
    const latest = await resolvePreset("demo", { compatibilityDate: "latest" });
    expect(latest?._meta?.name).toBe("demo-next");

    const recent = await resolvePreset("demo", { compatibilityDate: "2025-06-01" });
    expect(recent?._meta?.name).toBe("demo-next");

    const old = await resolvePreset("demo", { compatibilityDate: "2025-05-31" });
    expect(old?._meta?.name).toBe("demo");
  });

  it("uses the provider-specific date when set", async () => {
    const preset = await resolvePreset("demo", {
      compatibilityDate: { default: "2025-07-01", vercel: "2024-01-01" },
    });
    expect(preset?._meta?.name).toBe("demo");
  });

  it("throws when no variant satisfies the compatibility date", async () => {
    await expect(resolvePreset("gated", { compatibilityDate: "2024-01-01" })).rejects.toThrow(
      "requires compatibilityDate >= 2025-06-01"
    );
  });
});
