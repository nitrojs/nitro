import { describe, it, expect, vi, beforeEach } from "vitest";
import { valid as semverValid } from "semver";

vi.mock("node:fs", () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function mockRegistry(versions: string[]) {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ versions: Object.fromEntries(versions.map((v) => [v, {}])) }),
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  fetchMock.mockReset();
});

describe("fmtDate", async () => {
  const { fmtDate } = await import("../../scripts/bump-version.ts");

  it("formats date as YYMMDD", () => {
    expect(fmtDate(new Date("2026-03-11"))).toBe("260311");
    expect(fmtDate(new Date("2025-01-05"))).toBe("250105");
  });
});

describe("resolveVersion", async () => {
  const { resolveVersion } = await import("../../scripts/bump-version.ts");

  const cases = [
    { name: "no existing versions", existing: [], expected: "3.0.260311-beta" },
    { name: "one existing version", existing: ["3.0.260311-beta"], expected: "3.0.260311-beta.2" },
    {
      name: "multiple existing versions",
      existing: ["3.0.260311-beta", "3.0.260311-beta.2"],
      expected: "3.0.260311-beta.3",
    },
    {
      name: "other dates only",
      existing: ["3.0.260310-beta", "3.0.260310-beta.3"],
      expected: "3.0.260311-beta",
    },
    {
      name: "without prerelease tag",
      existing: ["3.0.260311-1", "3.0.260311-2"],
      expected: "3.0.260311-3",
      prerelease: "",
    },
    {
      name: "without prerelease, no existing",
      existing: [],
      expected: "3.0.260311",
      prerelease: "",
    },
  ];

  for (const { name, existing, expected, prerelease } of cases) {
    it(`${name}: ${existing.join(", ") || "(none)"} → ${expected}`, async () => {
      mockRegistry(existing);
      const version = await resolveVersion(
        "nitro",
        "260311",
        ...(prerelease !== undefined ? [prerelease] : [])
      );
      expect(version).toBe(expected);
      expect(semverValid(version)).toBe(version);
    });
  }
});
