import { describe, expect, it } from "vitest";
import { H3, toEventHandler } from "h3";
import { toFetchHandler } from "srvx/node";
import type { NodeHttp1Handler } from "srvx";
import type { Nitro, NitroEventHandler } from "nitro/types";

import routing from "../../src/build/virtual/routing.ts";

function createNitroStub(
  opts: {
    tracingChannel?: Nitro["options"]["tracingChannel"];
    handler?: Partial<NitroEventHandler>;
  } = {}
): Nitro {
  const handler: NitroEventHandler & { _importHash: string } = {
    route: "/foo",
    method: "GET",
    handler: "/path/to/handler.ts",
    _importHash: "_abc123",
    ...opts.handler,
  };

  return {
    options: {
      tracingChannel: opts.tracingChannel,
      baseURL: "/",
      routeRules: {},
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
    },
  } as unknown as Nitro;
}

describe("virtual/routing template", () => {
  it("does not wrap route handlers when tracingChannel is disabled", () => {
    const template = routing(createNitroStub()).template();
    expect(template).not.toContain("h3/tracing");
    expect(template).not.toContain("wrapHandlerWithTracing");
  });

  it("does not wrap route handlers when tracingChannel.h3 is false", () => {
    const template = routing(
      createNitroStub({ tracingChannel: { srvx: true, h3: false, unstorage: true } })
    ).template();
    expect(template).not.toContain("h3/tracing");
    expect(template).not.toContain("wrapHandlerWithTracing");
  });

  it("wraps route handlers with wrapHandlerWithTracing when tracingChannel.h3 is true", () => {
    const template = routing(
      createNitroStub({ tracingChannel: { srvx: true, h3: true, unstorage: true } })
    ).template();
    expect(template).toContain(`import { wrapHandlerWithTracing } from "h3/tracing"`);
    expect(template).toContain("wrapHandlerWithTracing(h3.toEventHandler(_abc123))");
  });

  it("does not convert web format handlers", () => {
    expect(routing(createNitroStub()).template()).not.toContain("srvxNode.toFetchHandler");
  });

  it("exposes converted node format handlers as a fetch object", () => {
    const template = routing(createNitroStub({ handler: { format: "node" } })).template();
    expect(template).toContain("h3.toEventHandler({ fetch: srvxNode.toFetchHandler(_abc123) })");
  });

  it("exposes converted lazy node format handlers as a fetch object", () => {
    const template = routing(
      createNitroStub({ handler: { format: "node", lazy: true } })
    ).template();
    expect(template).toContain(
      `h3.defineLazyEventHandler(() => import("/path/to/handler.ts").then(m => ({ fetch: srvxNode.toFetchHandler(m.default) })));`
    );
  });
});

describe("node format handler interop", () => {
  const nodeHandler: NodeHttp1Handler = (req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({ url: req.url, method: req.method, body, hasSignal: !!(req as any).signal })
      );
    });
  };

  it("passes a bare fetch handler through as an event handler", () => {
    const fetchHandler = toFetchHandler(nodeHandler);
    expect(toEventHandler(fetchHandler as any)).toBe(fetchHandler);
  });

  it("receives the real Request when registered as a fetch object", async () => {
    const app = new H3().all("/**", toEventHandler({ fetch: toFetchHandler(nodeHandler) })!);
    const res = await app.request(
      new Request("http://localhost/hello?a=1", { method: "POST", body: "ping" })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      url: "/hello?a=1",
      method: "POST",
      body: "ping",
      hasSignal: true,
    });
  });
});
