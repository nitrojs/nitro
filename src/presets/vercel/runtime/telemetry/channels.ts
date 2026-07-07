import type { IKeyValue, ChannelDescriber, SpanInfo } from "./types.ts";

// OTLP `SpanKind` (proto enum) Wire values: INTERNAL = 1, SERVER = 2, CLIENT = 3.
const SPAN_KIND_INTERNAL = 1;
const SPAN_KIND_CLIENT = 3;

/**
 * Resolve the describer for a channel: an exact first-party match, else a
 * namespaced-prefix match (first wins), else `undefined` so the caller falls
 * back to a generic span.
 */
export function resolveDescriber(channel: string): ChannelDescriber | undefined {
  return (
    CHANNEL_DESCRIBERS[channel] ??
    PREFIX_DESCRIBERS.find((entry) => channel.startsWith(entry.prefix))?.describe
  );
}

const CHANNEL_DESCRIBERS: Record<string, ChannelDescriber> = {
  "h3.request"(channel: string, data: unknown): SpanInfo {
    const { event, type } = data as {
      type: "middleware" | "route";
      event: { req: { method: string }; url: { pathname: string } };
    };
    const method = event.req.method;
    const path = event.url.pathname;
    return {
      name: type === "middleware" ? `middleware ${method} ${path}` : `${method} ${path}`,
      kind: SPAN_KIND_INTERNAL,
      attributes: [
        { key: "nitro.channel", value: { stringValue: channel } },
        { key: "http.request.method", value: { stringValue: method } },
        { key: "url.path", value: { stringValue: path } },
        { key: "nitro.h3.handler_type", value: { stringValue: type } },
      ],
    };
  },
  "srvx.request"(channel: string, data: unknown): SpanInfo {
    const { request, result } = data as {
      request: { method: string; url: string };
      result?: { status: number };
    };
    const method = request.method;
    const path = new URL(request.url).pathname;
    const attributes: IKeyValue[] = [
      { key: "nitro.channel", value: { stringValue: channel } },
      { key: "http.request.method", value: { stringValue: method } },
      { key: "url.path", value: { stringValue: path } },
    ];
    if (result) {
      attributes.push({ key: "http.response.status_code", value: { intValue: result.status } });
    }
    return { name: `${method} ${path}`, kind: SPAN_KIND_INTERNAL, attributes };
  },
  "srvx.middleware"(channel: string, data: unknown): SpanInfo {
    const { request, middleware } = data as {
      request: { method: string };
      middleware: { index: number; handler: { name: string } };
    };
    const handlerName = middleware.handler.name;
    const attributes: IKeyValue[] = [
      { key: "nitro.channel", value: { stringValue: channel } },
      { key: "nitro.middleware.index", value: { intValue: middleware.index } },
      { key: "http.request.method", value: { stringValue: request.method } },
    ];
    if (handlerName) {
      attributes.push({ key: "nitro.middleware.name", value: { stringValue: handlerName } });
    }
    return {
      name: `middleware ${handlerName || `#${middleware.index}`}`,
      kind: SPAN_KIND_INTERNAL,
      attributes,
    };
  },
};

// Namespaced channels with a dynamic operation suffix (e.g. `unstorage.getItem`,
// `unstorage.setItem`). Matched by prefix; first match wins. A future `db0.*`
// would slot in here as another entry.
const PREFIX_DESCRIBERS: Array<{ prefix: string; describe: ChannelDescriber }> = [
  {
    prefix: "unstorage.",
    describe(channel: string, data: unknown): SpanInfo {
      const { driver, base, keys } = data as {
        driver?: { name?: string };
        base?: string;
        keys?: unknown[];
      };
      const operation = channel.slice("unstorage.".length);
      // CLIENT: storage is a known outbound dependency (OTEL database semconv).
      const attributes: IKeyValue[] = [
        { key: "nitro.channel", value: { stringValue: channel } },
        { key: "db.operation", value: { stringValue: operation } },
      ];
      if (driver?.name) attributes.push({ key: "db.system", value: { stringValue: driver.name } });
      if (base) attributes.push({ key: "nitro.storage.base", value: { stringValue: base } });
      if (keys)
        attributes.push({ key: "nitro.storage.keys_count", value: { intValue: keys.length } });
      return {
        name: base ? `${operation} ${base}` : operation,
        kind: SPAN_KIND_CLIENT,
        attributes,
      };
    },
  },
];
