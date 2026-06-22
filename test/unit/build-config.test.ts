import { describe, expect, it } from "vitest";
import { resolveAliases } from "../../src/build/config.ts";

describe("build config", () => {
  it("resolves internal aliases without changing package aliases", () => {
    expect(
      resolveAliases({
        "~": "/root",
        "@": "/root",
        "#app": "@/app",
        "#build": "#app/build",
        "#ext": "@scope/package/subpath",
        package: "/node_modules/package",
        "@scope/package": "/node_modules/@scope/package",
      })
    ).toEqual({
      "@scope/package": "/node_modules/@scope/package",
      "#build": "/root/app/build",
      "#ext": "@scope/package/subpath",
      package: "/node_modules/package",
      "#app": "/root/app",
      "~": "/root",
      "@": "/root",
    });
  });

  it("resolves root double aliases (`~~` and `@@`) like single ones", () => {
    expect(
      resolveAliases({
        "~": "/root/src",
        "~~": "/root",
        "@": "/root/src",
        "@@": "/root",
        "#fromTildeTilde": "~~/build",
        "#fromAtAt": "@@/build",
      })
    ).toEqual({
      "#fromTildeTilde": "/root/build",
      "#fromAtAt": "/root/build",
      "~~": "/root",
      "@@": "/root",
      "~": "/root/src",
      "@": "/root/src",
    });
  });
});
