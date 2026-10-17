import { describe, expect, it } from "vitest";
import { getClientIP } from "../../src/presets/deno/runtime/_utils.ts";

describe("deno preset runtime: getClientIP", () => {
  it("resolves client IP from x-forwarded-for header", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.42" });
    const info = {
      remoteAddr: { transport: "tcp" as const, hostname: "34.120.54.102", port: 443 },
    };
    expect(getClientIP(headers, info)).toBe("203.0.113.42");
  });

  it("extracts the first client IP when multiple proxy IPs are present in x-forwarded-for", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.42, 198.51.100.1, 34.120.54.102" });
    const info = {
      remoteAddr: { transport: "tcp" as const, hostname: "34.120.54.102", port: 443 },
    };
    expect(getClientIP(headers, info)).toBe("203.0.113.42");
  });

  it("trims surrounding whitespace from x-forwarded-for client IP", () => {
    const headers = new Headers({ "x-forwarded-for": "  203.0.113.42  , 10.0.0.1 " });
    const info = {
      remoteAddr: { transport: "tcp" as const, hostname: "127.0.0.1", port: 3000 },
    };
    expect(getClientIP(headers, info)).toBe("203.0.113.42");
  });

  it("falls back to remoteAddr hostname when x-forwarded-for is absent", () => {
    const headers = new Headers({});
    const info = {
      remoteAddr: { transport: "tcp" as const, hostname: "127.0.0.1", port: 3000 },
    };
    expect(getClientIP(headers, info)).toBe("127.0.0.1");
  });

  it("falls back to remoteAddr hostname when x-forwarded-for is empty or whitespace", () => {
    const headers = new Headers({ "x-forwarded-for": "   " });
    const info = {
      remoteAddr: { transport: "tcp" as const, hostname: "127.0.0.1", port: 3000 },
    };
    expect(getClientIP(headers, info)).toBe("127.0.0.1");
  });

  it("supports generic headers-like objects implementing get()", () => {
    const headers = {
      get(name: string) {
        return name === "x-forwarded-for" ? "198.51.100.24" : null;
      },
    };
    expect(getClientIP(headers)).toBe("198.51.100.24");
  });

  it("returns undefined when neither x-forwarded-for nor valid remoteAddr hostname is available", () => {
    const headers = new Headers({});
    const unixInfo = {
      remoteAddr: { transport: "unix" as const, path: "/tmp/deno.sock" },
    };
    expect(getClientIP(headers, unixInfo as any)).toBeUndefined();
    expect(getClientIP(headers, undefined)).toBeUndefined();
  });
});
