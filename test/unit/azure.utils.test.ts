import { describe, expect, it } from "vitest";
import {
  getAzureParsedCookiesFromHeaders,
  getRequestURL,
  resolveBaseUrl,
} from "../../src/presets/azure/runtime/_utils.ts";

describe("getAzureParsedCookiesFromHeaders", () => {
  it("returns empty array if no cookies", () => {
    expect(getAzureParsedCookiesFromHeaders(new Headers({}))).toMatchObject([]);
  });
  it("returns empty array if empty set-cookie header", () => {
    expect(getAzureParsedCookiesFromHeaders(new Headers({ "set-cookie": " " }))).toMatchObject([]);
  });
  it("returns single cookie", () => {
    expect(
      getAzureParsedCookiesFromHeaders(new Headers({ "set-cookie": "foo=bar" }))
    ).toMatchObject([
      {
        name: "foo",
        value: "bar",
      },
    ]);
  });
  it('returns cookie with "expires" attribute', () => {
    expect(
      getAzureParsedCookiesFromHeaders(
        new Headers({
          "set-cookie": "foo=bar; expires=Thu, 01 Jan 1970 00:00:00 GMT",
        })
      )
    ).toMatchObject([
      {
        name: "foo",
        value: "bar",
        expires: new Date("1970-01-01T00:00:00.000Z"),
      },
    ]);
  });
  it("returns a complex cookie", () => {
    expect(
      getAzureParsedCookiesFromHeaders(
        new Headers({
          "set-cookie":
            "session=xyz; Path=/; Expires=Sun, 24 Mar 2024 09:13:27 GMT; HttpOnly; SameSite=Strict",
        })
      )
    ).toMatchObject([
      {
        name: "session",
        value: "xyz",
        expires: new Date("2024-03-24T09:13:27.000Z"),
        path: "/",
        sameSite: "Strict",
        httpOnly: true,
      },
    ]);
  });
  it("returns multiple cookies", () => {
    expect(
      getAzureParsedCookiesFromHeaders(
        new Headers([
          ["set-cookie", "foo=bar"],
          ["set-cookie", "baz=qux"],
        ])
      )
    ).toMatchObject([
      {
        name: "foo",
        value: "bar",
      },
      {
        name: "baz",
        value: "qux",
      },
    ]);
  });
});

describe("resolveBaseUrl", () => {
  const req = (headers: Record<string, string>) => new Headers(headers);

  it("uses the forwarded proto and host", () => {
    expect(
      resolveBaseUrl(req({ "x-forwarded-proto": "https", "x-forwarded-host": "example.com" }))
    ).toBe("https://example.com");
  });

  it("falls back to the host header and http", () => {
    expect(resolveBaseUrl(req({ host: "example.com:8080" }))).toBe("http://example.com:8080");
  });

  it("falls back to the origin of x-ms-original-url", () => {
    expect(resolveBaseUrl(req({ "x-ms-original-url": "https://example.com/foo?bar=1" }))).toBe(
      "https://example.com"
    );
  });

  it("ignores an unusable host", () => {
    expect(
      resolveBaseUrl(req({ host: "not a host", "x-ms-original-url": "https://example.com/foo" }))
    ).toBe("https://example.com");
  });

  it("falls back to localhost", () => {
    expect(resolveBaseUrl(req({}))).toBe("http://localhost");
  });
});

describe("getRequestURL", () => {
  const headers = new Headers({ "x-forwarded-proto": "https", "x-forwarded-host": "example.com" });

  it("resolves the path and query against the base url", () => {
    expect(getRequestURL("https://internal/api/echo?x=1", headers).href).toBe(
      "https://example.com/api/echo?x=1"
    );
    expect(getRequestURL("/api/echo?x=1", headers).href).toBe("https://example.com/api/echo?x=1");
  });

  it("keeps encoded characters in the path", () => {
    expect(getRequestURL("https://internal/api/a%2Fb%3Fc?q=1", headers).href).toBe(
      "https://example.com/api/a%2Fb%3Fc?q=1"
    );
  });

  it("does not change the host for paths starting with slashes", () => {
    expect(getRequestURL("https://example.com//evil.com/foo?x=1", headers).href).toBe(
      "https://example.com//evil.com/foo?x=1"
    );
    expect(getRequestURL("https://example.com/\\evil.com/foo", headers).host).toBe("example.com");
  });
});
