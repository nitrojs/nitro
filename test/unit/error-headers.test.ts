import { describe, expect, it } from "vitest";
import { mockEvent } from "h3";
import { createErrorHeaders } from "../../src/runtime/internal/error/utils.ts";

describe("createErrorHeaders", () => {
  it("preserves staged error precedence without merging success headers", () => {
    const event = mockEvent("/");
    event.res.headers.set("x-success-only", "success");
    event.res.errHeaders.set("x-shared", "staged");
    event.res.errHeaders.set("x-staged-only", "staged");
    const errorHeaders = new Headers({ "x-shared": "error", "x-error-only": "error" });

    const headers = createErrorHeaders(event, errorHeaders);

    expect(headers.get("x-shared")).toBe("staged");
    expect(headers.get("x-staged-only")).toBe("staged");
    expect(headers.get("x-error-only")).toBe("error");
    expect(headers.has("x-success-only")).toBe(false);
    expect(errorHeaders.get("x-shared")).toBe("error");
  });

  it("appends cookies from both sources without combining them", () => {
    const event = mockEvent("/");
    event.res.errHeaders.append("set-cookie", "staged=1; Path=/");
    const errorHeaders = new Headers();
    errorHeaders.append("set-cookie", "first=1; Path=/");
    errorHeaders.append("set-cookie", "second=2; Path=/");

    expect(createErrorHeaders(event, errorHeaders).getSetCookie()).toEqual([
      "first=1; Path=/",
      "second=2; Path=/",
      "staged=1; Path=/",
    ]);
    expect(errorHeaders.getSetCookie()).toHaveLength(2);
    expect(event.res.errHeaders.getSetCookie()).toEqual(["staged=1; Path=/"]);
  });

  it("preserves staged headers without explicit error headers", () => {
    const event = mockEvent("/");
    event.res.errHeaders.set("x-staged", "value");

    expect(createErrorHeaders(event).get("x-staged")).toBe("value");
  });
});
