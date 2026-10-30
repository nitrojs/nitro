import { describe, expect, it } from "vitest";
import { resolveNodeRuntime } from "../../src/presets/vercel/utils";

describe("vercel: resolveNodeRuntime", () => {
  it.each([
    [20, "nodejs20.x"],
    [22, "nodejs22.x"],
    [24, "nodejs24.x"],
    [26, "nodejs26.x"],
    // Future majors need no code change
    [27, "nodejs27.x"],
    [28, "nodejs28.x"],
    [29, "nodejs29.x"],
    [30, "nodejs30.x"],
  ])(
    "uses the runtime of a supported Node.js major (%s)",
    (major, expected) => {
      expect(resolveNodeRuntime(major)).toBe(expected);
    }
  );

  it.each([
    [21, "nodejs22.x"],
    [23, "nodejs24.x"],
    [25, "nodejs26.x"],
  ])("uses the next supported major for Node.js %s", (major, expected) => {
    expect(resolveNodeRuntime(major)).toBe(expected);
  });

  it.each([16, 18, 19])("uses the oldest runtime for Node.js %s", (major) => {
    expect(resolveNodeRuntime(major)).toBe("nodejs20.x");
  });

  it("detects the Node.js major of the running process", () => {
    const node = Object.getOwnPropertyDescriptor(process.versions, "node")!;
    try {
      Object.defineProperty(process.versions, "node", {
        value: "26.1.0",
        configurable: true,
      });
      expect(resolveNodeRuntime()).toBe("nodejs26.x");
      Object.defineProperty(process.versions, "node", {
        value: "24.0.0",
        configurable: true,
      });
      expect(resolveNodeRuntime()).toBe("nodejs24.x");
    } finally {
      Object.defineProperty(process.versions, "node", node);
    }
  });
});
