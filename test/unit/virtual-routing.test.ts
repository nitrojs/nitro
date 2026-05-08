import { describe, expect, it } from "vitest";
import type { Nitro, NitroEventHandler } from "nitro/types";

import routing from "../../src/build/virtual/routing.ts";

function createNitroStub(tracingChannel: Nitro["options"]["tracingChannel"]): Nitro {
  const handler: NitroEventHandler & { _importHash: string } = {
    route: "/foo",
    method: "GET",
    handler: "/path/to/handler.ts",
    _importHash: "_abc123",
  };

  return {
    options: {
      tracingChannel,
    },
    routing: {
      routes: {
        routes: [{ route: "/foo", method: "GET", data: handler }],
        compileToString: ({ serialize }: { serialize: (h: unknown) => string }) =>
          `{"/foo":${serialize(handler)}}`,
      },
      routedMiddleware: {
        routes: [],
        compileToString: () => `{}`,
      },
      globalMiddleware: [],
      routeRules: {
        compileToString: () => `() => []`,
      },
    },
  } as unknown as Nitro;
}

describe("virtual/routing template", () => {
  it("does not wrap route handlers when tracingChannel is disabled", () => {
    const template = routing(createNitroStub(undefined)).template();
    expect(template).not.toContain("h3/tracing");
    expect(template).not.toContain("wrapHandlerWithTracing");
  });

  it("does not wrap route handlers when tracingChannel.h3 is false", () => {
    const template = routing(
      createNitroStub({ srvx: true, h3: false, unstorage: true })
    ).template();
    expect(template).not.toContain("h3/tracing");
    expect(template).not.toContain("wrapHandlerWithTracing");
  });

  it("wraps route handlers with wrapHandlerWithTracing when tracingChannel.h3 is true", () => {
    const template = routing(createNitroStub({ srvx: true, h3: true, unstorage: true })).template();
    expect(template).toContain(`import { wrapHandlerWithTracing } from "h3/tracing"`);
    expect(template).toContain("wrapHandlerWithTracing(h3.toEventHandler(_abc123))");
  });
});
