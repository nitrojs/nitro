import {
  type EventHandler,
  createEvent,
  defineEventHandler,
  fetchWithEvent,
  handleCacheHeaders,
  isEvent,
  splitCookiesString,
} from "h3";
import type { EventHandlerRequest, EventHandlerResponse, H3Event } from "h3";
import type {
  $Fetch,
  CacheEntry,
  CacheOptions,
  CachedEventHandlerOptions,
  NitroFetchRequest,
  ResponseCacheEntry,
} from "nitropack/types";
import { parseURL } from "ufo";
import { useNitroApp } from "./app";
import { useStorage } from "./storage";
import { hash } from "./hash";
import type { TransactionOptions } from "unstorage";

function defaultCacheOptions() {
  return {
    name: "_",
    base: "/cache",
    swr: true,
    maxAge: 1,
  } as const;
}

type ResolvedCacheEntry<T> = CacheEntry<T> & { value: T };

type InternalCacheOptions<T> = CacheOptions<T> & {
  /** @internal */
  _removeStaleOnInvalid?: (entry: CacheEntry<T>) => boolean;
};

export function defineCachedFunction<T, ArgsT extends unknown[] = any[]>(
  fn: (...args: ArgsT) => T | Promise<T>,
  opts: CacheOptions<T, ArgsT> = {}
): (...args: ArgsT) => Promise<T> {
  opts = { ...defaultCacheOptions(), ...opts };

  const pending: { [key: string]: Promise<T> } = {};

  // Normalize cache params
  const group = opts.group || "nitro/functions";
  const name = opts.name || fn.name || "_";
  const integrity = opts.integrity || hash([fn, opts]);
  const validate = opts.validate || ((entry) => entry.value !== undefined);

  async function get(
    key: string,
    resolver: () => T | Promise<T>,
    shouldInvalidateCache?: boolean,
    event?: H3Event
  ): Promise<ResolvedCacheEntry<T>> {
    // Use extension for key to avoid conflicting with parent namespace (foo/bar and foo/bar/baz)
    const cacheKey = [opts.base, group, name, key + ".json"]
      .filter(Boolean)
      .join(":")
      .replace(/:\/$/, ":index");

    let entry: CacheEntry<T> =
      ((await useStorage()
        .getItem(cacheKey)
        .catch((error) => {
          console.error(`[cache] Cache read error.`, error);
          useNitroApp().captureError(error, { event, tags: ["cache"] });
        })) as unknown) || {};

    // https://github.com/nitrojs/nitro/issues/2160
    if (typeof entry !== "object") {
      entry = {};
      const error = new Error("Malformed data read from cache.");
      console.error("[cache]", error);
      useNitroApp().captureError(error, { event, tags: ["cache"] });
    }

    const ttl = (opts.maxAge ?? 0) * 1000;
    if (ttl) {
      entry.expires = Date.now() + ttl;
    }

    const expired =
      shouldInvalidateCache ||
      entry.integrity !== integrity ||
      (ttl && Date.now() - (entry.mtime || 0) > ttl) ||
      validate(entry) === false;

    const _resolve = async () => {
      const isPending = pending[key];
      if (!isPending) {
        if (
          entry.value !== undefined &&
          (opts.staleMaxAge || 0) >= 0 &&
          opts.swr === false
        ) {
          // Remove cached entry to prevent using expired cache on concurrent requests
          entry.value = undefined;
          entry.integrity = undefined;
          entry.mtime = undefined;
          entry.expires = undefined;
        }
        pending[key] = Promise.resolve(resolver());
      }

      try {
        entry.value = await pending[key];
      } catch (error) {
        // Make sure entries that reject get removed.
        if (!isPending) {
          delete pending[key];
        }
        // Re-throw error to make sure the caller knows the task failed.
        throw error;
      }

      if (!isPending) {
        // Update mtime, integrity + validate and set the value in cache only the first time the request is made.
        entry.mtime = Date.now();
        entry.integrity = integrity;
        delete pending[key];
        if (validate(entry) !== false) {
          let setOpts: TransactionOptions | undefined;
          if (opts.maxAge && !opts.swr /* TODO: respect staleMaxAge */) {
            setOpts = { ttl: opts.maxAge };
          }
          const promise = useStorage()
            .setItem(cacheKey, entry, setOpts)
            .catch((error) => {
              console.error(`[cache] Cache write error.`, error);
              useNitroApp().captureError(error, { event, tags: ["cache"] });
            });
          if (event?.waitUntil) {
            event.waitUntil(promise);
          }
        } else if (
          (opts as InternalCacheOptions<T>)._removeStaleOnInvalid?.(entry)
        ) {
          // Fresh result must not be cached: drop any previously stored entry
          // so that it is not served (stale) anymore.
          const promise = useStorage()
            .removeItem(cacheKey)
            .catch((error) => {
              console.error(`[cache] Cache remove error.`, error);
              useNitroApp().captureError(error, { event, tags: ["cache"] });
            });
          if (event?.waitUntil) {
            event.waitUntil(promise);
          }
        }
      }
    };

    const _resolvePromise = expired ? _resolve() : Promise.resolve();

    if (entry.value === undefined) {
      await _resolvePromise;
    } else if (expired && event && event.waitUntil) {
      event.waitUntil(_resolvePromise);
    }

    if (opts.swr && validate(entry) !== false) {
      _resolvePromise.catch((error) => {
        console.error(`[cache] SWR handler error.`, error);
        useNitroApp().captureError(error, { event, tags: ["cache"] });
      });
      return entry as ResolvedCacheEntry<T>;
    }

    return _resolvePromise.then(() => entry) as Promise<ResolvedCacheEntry<T>>;
  }

  return async (...args) => {
    const shouldBypassCache = await opts.shouldBypassCache?.(...args);
    if (shouldBypassCache) {
      return fn(...args);
    }
    const key = await (opts.getKey || getKey)(...args);
    const shouldInvalidateCache = await opts.shouldInvalidateCache?.(...args);
    const entry = await get(
      key,
      () => fn(...args),
      shouldInvalidateCache,
      args[0] && isEvent(args[0]) ? args[0] : undefined
    );
    let value = entry.value;
    if (opts.transform) {
      value = (await opts.transform(entry, ...args)) || value;
    }
    return value;
  };
}

export function cachedFunction<T, ArgsT extends unknown[] = any[]>(
  fn: (...args: ArgsT) => T | Promise<T>,
  opts: CacheOptions<T> = {}
): (...args: ArgsT) => Promise<T | undefined> {
  return defineCachedFunction(fn, opts);
}

function getKey(...args: unknown[]) {
  return args.length > 0 ? hash(args) : "";
}

function escapeKey(key: string | string[]) {
  return String(key).replace(/\W/g, "");
}

export function defineCachedEventHandler<
  Request extends EventHandlerRequest = EventHandlerRequest,
  Response = EventHandlerResponse,
>(
  handler: EventHandler<Request, Response>,
  opts?: CachedEventHandlerOptions<Response>
): EventHandler<Omit<Request, "body">, Response>;
// TODO: remove when appropriate
// This signature provides backwards compatibility with previous signature where first generic was return type
export function defineCachedEventHandler<
  Request = Omit<EventHandlerRequest, "body">,
  Response = EventHandlerResponse,
>(
  handler: EventHandler<
    Request extends EventHandlerRequest ? Request : EventHandlerRequest,
    Request extends EventHandlerRequest ? Response : Request
  >,
  opts?: CachedEventHandlerOptions<
    Request extends EventHandlerRequest ? Response : Request
  >
): EventHandler<
  Request extends EventHandlerRequest ? Request : EventHandlerRequest,
  Request extends EventHandlerRequest ? Response : Request
>;
export function defineCachedEventHandler<
  Request extends EventHandlerRequest = EventHandlerRequest,
  Response = EventHandlerResponse,
>(
  handler: EventHandler<Request, Response>,
  opts: CachedEventHandlerOptions<Response> = defaultCacheOptions()
): EventHandler<Request, Response> {
  const variableHeaderNames = (opts.varies || [])
    .filter(Boolean)
    .map((h) => h.toLowerCase())
    .sort();

  const _opts: InternalCacheOptions<ResponseCacheEntry<Response>> = {
    ...opts,
    getKey: async (event: H3Event) => {
      // HEAD responses are stored separately from GET (GET keys stay unchanged)
      const _methodSuffix = event.method === "HEAD" ? ":HEAD" : "";
      // Custom user-defined key
      const customKey = await opts.getKey?.(event);
      if (customKey) {
        return escapeKey(customKey) + _methodSuffix;
      }
      // Auto-generated key
      const _path =
        event.node.req.originalUrl || event.node.req.url || event.path;
      let _pathname: string;
      try {
        _pathname =
          escapeKey(decodeURI(parseURL(_path).pathname)).slice(0, 16) ||
          "index";
      } catch {
        _pathname = "-";
      }
      const _hashedPath = `${_pathname}.${hash(_path)}`;
      const _headers = variableHeaderNames
        .map((header) => [header, event.node.req.headers[header]])
        .map(([name, value]) => `${escapeKey(name as string)}.${hash(value)}`);
      return [_hashedPath, ..._headers].join(":") + _methodSuffix;
    },
    validate: (entry) => {
      if (!entry.value) {
        return false;
      }
      if (entry.value.code >= 400) {
        return false;
      }
      if (entry.value.body === undefined) {
        return false;
      }
      // https://github.com/nitrojs/nitro/pull/1857
      if (
        entry.value.headers.etag === "undefined" ||
        entry.value.headers["last-modified"] === "undefined"
      ) {
        return false;
      }
      // Never store responses that are user-specific or opted out of caching
      if (!isCacheableResponse(entry.value.headers, variableHeaderNames)) {
        return false;
      }
      return true;
    },
    _removeStaleOnInvalid: (entry) =>
      !!entry.value &&
      !isCacheableResponse(entry.value.headers, variableHeaderNames),
    group: opts.group || "nitro/handlers",
    integrity: opts.integrity || hash([handler, opts]),
  };

  const _resolveResponse = async (
    incomingEvent: H3Event
  ): Promise<ResponseCacheEntry<Response>> => {
    // Only pass headers which are defined in opts.varies
    const variableHeaders: Record<string, string | string[]> = {};
    for (const header of variableHeaderNames) {
      const value = incomingEvent.node.req.headers[header];
      if (value !== undefined) {
        variableHeaders[header] = value;
      }
    }

    // Create proxies to avoid sharing state with user request
    const reqProxy = cloneWithProxy(incomingEvent.node.req, {
      headers: variableHeaders,
    });
    const resHeaders: Record<string, number | string | string[]> = {};
    let _resSendBody;
    const resProxy = cloneWithProxy(incomingEvent.node.res, {
      statusCode: 200,
      writableEnded: false,
      writableFinished: false,
      headersSent: false,
      closed: false,
      getHeader(name) {
        return resHeaders[name];
      },
      setHeader(name, value) {
        resHeaders[name] = value as any;
        return this as typeof incomingEvent.node.res;
      },
      getHeaderNames() {
        return Object.keys(resHeaders);
      },
      hasHeader(name) {
        return name in resHeaders;
      },
      removeHeader(name) {
        delete resHeaders[name];
      },
      appendHeader(name, value) {
        const values = [resHeaders[name], value]
          .flat()
          .filter((v) => v !== undefined)
          .map(String);
        resHeaders[name] = values.length === 1 ? values[0] : values;
        return this as typeof incomingEvent.node.res;
      },
      getHeaders() {
        return resHeaders;
      },
      end(chunk, arg2?, arg3?) {
        if (typeof chunk === "string") {
          _resSendBody = chunk;
        }
        if (typeof arg2 === "function") {
          arg2();
        }
        if (typeof arg3 === "function") {
          arg3();
        }
        return this as typeof incomingEvent.node.res;
      },
      write(chunk, arg2?, arg3?) {
        if (typeof chunk === "string") {
          _resSendBody = chunk;
        }
        if (typeof arg2 === "function") {
          arg2(undefined);
        }
        if (typeof arg3 === "function") {
          arg3();
        }
        return true;
      },
      writeHead(statusCode, headers) {
        this.statusCode = statusCode;
        if (headers) {
          if (Array.isArray(headers) || typeof headers === "string") {
            throw new TypeError("Raw headers  is not supported.");
          }
          for (const header in headers) {
            const value = headers[header];
            if (value !== undefined) {
              (this as typeof incomingEvent.node.res).setHeader(header, value);
            }
          }
        }
        return this as typeof incomingEvent.node.res;
      },
    });

    // Call handler
    const event = createEvent(reqProxy, resProxy);
    event._path = incomingEvent._path;
    // Assign bound fetch to context
    event.fetch = (url, fetchOptions) =>
      fetchWithEvent(event, url, fetchOptions, {
        fetch: useNitroApp().localFetch as any,
      });
    event.$fetch = (url, fetchOptions) =>
      fetchWithEvent(event, url, fetchOptions as RequestInit, {
        fetch: globalThis.$fetch as any,
      });
    event.waitUntil = incomingEvent.waitUntil;
    event.context = incomingEvent.context;
    event.context.cache = {
      options: _opts,
    };
    const body = (await handler(event)) || _resSendBody;

    // Collect cacheable headers
    const headers = event.node.res.getHeaders();
    headers.etag = String(headers.Etag || headers.etag || `W/"${hash(body)}"`);
    headers["last-modified"] = String(
      headers["Last-Modified"] ||
        headers["last-modified"] ||
        new Date().toUTCString()
    );
    const cacheControl = [];
    if (!isCacheableResponse(headers, variableHeaderNames)) {
      // Response will not be stored: keep the handler's own `cache-control`
    } else if (opts.swr) {
      if (opts.maxAge) {
        cacheControl.push(`s-maxage=${opts.maxAge}`);
      }
      if (opts.staleMaxAge) {
        cacheControl.push(`stale-while-revalidate=${opts.staleMaxAge}`);
      } else {
        cacheControl.push("stale-while-revalidate");
      }
    } else if (opts.maxAge) {
      cacheControl.push(`max-age=${opts.maxAge}`);
    }
    if (cacheControl.length > 0) {
      headers["cache-control"] = cacheControl.join(", ");
    }

    // Create cache entry for response
    const cacheEntry: ResponseCacheEntry<Response> = {
      code: event.node.res.statusCode,
      headers,
      body,
    };

    // Remember which request produced this entry so that per-user headers
    // (`set-cookie`) are only sent back to that request and never to other
    // requests sharing the same (pending or stored) entry.
    // Non-cacheable entries are never stored and are re-resolved for
    // concurrent requests that did not produce them.
    responseOrigins.set(cacheEntry, incomingEvent);

    return cacheEntry;
  };

  const _cachedHandler = cachedFunction<ResponseCacheEntry<Response>>(
    // Anonymous wrapper keeps the default cache name (`fn.name` fallback) unchanged
    (event) => _resolveResponse(event),
    _opts
  );

  return defineEventHandler<Request, any>(async (event) => {
    // Only GET and HEAD requests are cached. Other methods and range requests
    // are always handled directly.
    if (
      (event.method !== "GET" && event.method !== "HEAD") ||
      event.node.req.headers.range !== undefined
    ) {
      return handler(event);
    }

    // Headers-only mode
    if (opts.headersOnly) {
      // TODO: Send SWR too
      if (handleCacheHeaders(event, { maxAge: opts.maxAge })) {
        return;
      }
      return handler(event);
    }

    // Call with cache
    let response = (await _cachedHandler(
      event
    )) as ResponseCacheEntry<Response>;

    // Non-cacheable responses (user-specific or opted out of caching) must
    // never be shared. If this request received one produced for another
    // (concurrent) request, resolve its own response instead.
    let isCacheable = isCacheableResponse(
      response.headers,
      variableHeaderNames
    );
    if (!isCacheable && responseOrigins.get(response) !== event) {
      response = await _resolveResponse(event);
      isCacheable = isCacheableResponse(response.headers, variableHeaderNames);
    }

    // Don't continue if response is already handled by user
    if (event.node.res.headersSent || event.node.res.writableEnded) {
      return response.body;
    }

    const isOrigin = responseOrigins.get(response) === event;

    // Check for cache headers
    if (
      isCacheable &&
      handleCacheHeaders(event, {
        modifiedTime: new Date(response.headers["last-modified"] as string),
        etag: response.headers.etag as string,
        maxAge: opts.maxAge,
      })
    ) {
      return;
    }

    // Send status and headers
    event.node.res.statusCode = response.code;
    for (const name in response.headers) {
      const value = response.headers[name];
      if (name.toLowerCase() === "set-cookie") {
        // Cookies are only sent to the request that produced the response
        // (responses setting cookies are never stored in the cache)
        if (isOrigin && value !== undefined) {
          event.node.res.appendHeader(
            name,
            splitCookiesString(value as string | string[])
          );
        }
      } else {
        if (value !== undefined) {
          event.node.res.setHeader(name, value);
        }
      }
    }

    // Send body
    return response.body;
  });
}

const responseOrigins = new WeakMap<ResponseCacheEntry, H3Event>();

function getHeaderValue(
  headers: ResponseCacheEntry["headers"],
  name: string
): string | undefined {
  const values: string[] = [];
  for (const key in headers) {
    if (key.toLowerCase() === name) {
      const value = headers[key];
      if (value !== undefined) {
        values.push(Array.isArray(value) ? value.join(", ") : String(value));
      }
    }
  }
  return values.length > 0 ? values.join(", ") : undefined;
}

// `accept-encoding` is ignored since content encoding is applied after the handler
const VARY_IGNORED_HEADERS = new Set(["accept-encoding"]);

function isCacheableResponse(
  headers: ResponseCacheEntry["headers"],
  variableHeaderNames: string[]
): boolean {
  // Responses setting cookies are user-specific
  if (getHeaderValue(headers, "set-cookie") !== undefined) {
    return false;
  }
  // Respect explicit opt-out from shared caching
  const cacheControl = getHeaderValue(headers, "cache-control");
  if (
    cacheControl &&
    /(?:^|[\s,])(?:private|no-store|no-cache)(?:$|[\s,=])/i.test(cacheControl)
  ) {
    return false;
  }
  // Response varies on request headers that are not part of the cache key
  const vary = getHeaderValue(headers, "vary");
  if (vary) {
    for (const _name of vary.split(",")) {
      const name = _name.trim().toLowerCase();
      if (!name || VARY_IGNORED_HEADERS.has(name)) {
        continue;
      }
      if (name === "*" || !variableHeaderNames.includes(name)) {
        return false;
      }
    }
  }
  return true;
}

function cloneWithProxy<T extends object = any>(
  obj: T,
  overrides: Partial<T>
): T {
  return new Proxy(obj, {
    get(target, property, receiver) {
      if (property in overrides) {
        return overrides[property as keyof T];
      }
      return Reflect.get(target, property, receiver);
    },
    set(target, property, value, receiver) {
      if (property in overrides) {
        overrides[property as keyof T] = value;
        return true;
      }
      return Reflect.set(target, property, value, receiver);
    },
  });
}

export const cachedEventHandler = defineCachedEventHandler;
