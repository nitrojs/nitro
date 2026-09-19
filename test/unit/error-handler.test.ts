import { describe, expect, it } from "vitest";
import type { H3Error, H3Event } from "h3";

import { defaultHandler } from "../../src/runtime/internal/error/prod";
import { defaultHandler as devDefaultHandler } from "../../src/runtime/internal/error/dev";

function createEvent(headers: Record<string, string>, path = "/x"): H3Event {
  return {
    path,
    node: {
      req: {
        headers,
        socket: {},
      },
      res: {},
    },
  } as unknown as H3Event;
}

function createError(statusCode: number): H3Error {
  return { statusCode, statusMessage: "Not Found" } as H3Error;
}

describe("defaultHandler", () => {
  it("resolves the URL from a valid Host header", () => {
    const event = createEvent({ host: "example.test:3000" });
    const res = defaultHandler(createError(404), event, { silent: true });
    expect(res.status).toBe(404);
    expect((res.body as any).url).toBe("http://example.test:3000/x");
  });

  it("does not throw for an unparsable Host header and degrades gracefully", () => {
    // `Host: a b` makes `new URL()` throw inside the handler, escaping as an
    // unhandled rejection (issue #4555).
    const event = createEvent({ host: "a b" });
    const res = defaultHandler(createError(404), event, { silent: true });
    expect(res.status).toBe(404);
    expect((res.body as any).url).toBe("http://localhost/x");
  });

  it("keeps path and query intact when degrading to the fallback authority", () => {
    const event = createEvent({ host: "a b" }, "/x/y?z=1");
    const res = defaultHandler(createError(404), event, { silent: true });
    expect((res.body as any).url).toBe("http://localhost/x/y?z=1");
  });

  it("prefers a valid x-forwarded-host over the Host header", () => {
    const event = createEvent({
      host: "internal.test",
      "x-forwarded-host": "public.test",
      "x-forwarded-proto": "https",
    });
    const res = defaultHandler(createError(404), event, { silent: true });
    expect((res.body as any).url).toBe("https://public.test/x");
  });

  it("does not throw for an unparsable Host header in the dev handler either", async () => {
    const event = createEvent({ host: "a b" });
    const res = await devDefaultHandler(createError(404), event, {
      silent: true,
      json: true,
    });
    expect(res.status).toBe(404);
    // the dev JSON body embeds the URL instance itself (pre-existing shape)
    expect(((res.body as any).url as URL).href).toBe("http://localhost/x");
  });
});
