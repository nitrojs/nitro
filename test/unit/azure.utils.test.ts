import { describe, expect, it } from "vitest";
import {
  getAzureParsedCookiesFromHeaders,
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
  const req = (headers: Record<string, string>) => ({ headers }) as any;

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
