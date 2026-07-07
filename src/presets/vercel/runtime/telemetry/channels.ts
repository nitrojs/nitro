import type { IKeyValue, ChannelDescriber, SpanInfo } from "./types.ts";

// OTLP `SpanKind` (proto enum) Wire values: INTERNAL = 1, SERVER = 2, CLIENT = 3.
const SPAN_KIND_INTERNAL = 1;
const SPAN_KIND_CLIENT = 3;

/**
 * Every tracing channel Nitro instruments, keyed by channel name and mapped to
 * the describer that turns a completed operation into a span name, kind and
 * attributes. The plugin subscribes to exactly these channels
 * (`tracing:<name>:*`); channels absent from this table are not traced.
 *
 * Declaring the names here — instead of wrapping `tracingChannel` to discover
 * them at runtime — is what lets the runtime patch no globals and never observe
 * unknown/third-party channels.
 */
export const TRACED_CHANNELS: Record<string, ChannelDescriber> = {
  "h3.request"(channel: string, data: unknown): SpanInfo {
    const { event, type } = data as {
      type: "middleware" | "route";
      event: {
        req: { method: string };
        url: { pathname: string };
        context?: { matchedRoute?: { route?: string } };
      };
    };
    const method = event.req.method;
    const path = event.url.pathname;
    // Prefer the matched route template (`/users/:id`) for the span name so it
    // stays low-cardinality per OTEL HTTP semconv; fall back to the concrete
    // path when the request didn't match a route (404, middleware-only).
    const route = event.context?.matchedRoute?.route;
    const target = route || path;
    const attributes: IKeyValue[] = [
      { key: "nitro.channel", value: { stringValue: channel } },
      { key: "http.request.method", value: { stringValue: method } },
      { key: "url.path", value: { stringValue: path } },
      { key: "nitro.h3.handler_type", value: { stringValue: type } },
    ];
    if (route) {
      attributes.push({ key: "http.route", value: { stringValue: route } });
    }
    return {
      name: type === "middleware" ? `middleware ${method} ${target}` : `${method} ${target}`,
      kind: SPAN_KIND_INTERNAL,
      attributes,
    };
  },
  "srvx.request"(channel: string, data: unknown): SpanInfo {
    const { request, result } = data as {
      request: { method: string; url: string; context?: { matchedRoute?: { route?: string } } };
      result?: { status: number };
    };
    const method = request.method;
    const path = new URL(request.url).pathname;
    // The srvx span wraps the whole request, so by the time it closes h3 has
    // populated `matchedRoute` on the shared request context. Prefer that route
    // template for a low-cardinality span name (OTEL HTTP semconv), matching the
    // `h3.request` span; fall back to the concrete path for unmatched requests
    // (static assets, 404s).
    const route = request.context?.matchedRoute?.route;
    const attributes: IKeyValue[] = [
      { key: "nitro.channel", value: { stringValue: channel } },
      { key: "http.request.method", value: { stringValue: method } },
      { key: "url.path", value: { stringValue: path } },
    ];
    if (route) {
      attributes.push({ key: "http.route", value: { stringValue: route } });
    }
    if (result) {
      attributes.push({ key: "http.response.status_code", value: { intValue: result.status } });
    }
    return { name: `${method} ${route || path}`, kind: SPAN_KIND_INTERNAL, attributes };
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
  ...Object.fromEntries(
    [
      "getItem",
      "getItems",
      "getItemRaw",
      "getMeta",
      "getKeys",
      "hasItem",
      "setItem",
      "setItems",
      "setItemRaw",
      "removeItem",
      "clear",
    ].map((operation) => [
      `unstorage.${operation}`,
      (channel: string, data: unknown) => {
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
        if (driver?.name)
          attributes.push({ key: "db.system", value: { stringValue: driver.name } });
        if (base) attributes.push({ key: "nitro.storage.base", value: { stringValue: base } });
        if (keys)
          attributes.push({ key: "nitro.storage.keys_count", value: { intValue: keys.length } });
        return {
          name: base ? `${operation} ${base}` : operation,
          kind: SPAN_KIND_CLIENT,
          attributes,
        } satisfies SpanInfo;
      },
    ])
  ),
};
