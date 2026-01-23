import { defineHandler, handleCacheHeaders, isHTTPEvent, toResponse } from "h3";
import { FastResponse } from "srvx";
import { parseURL } from "ufo";
import { hash } from "ohash";
import { useNitroApp } from "./app.ts";
import { useStorage } from "./storage.ts";

import type { H3Event, EventHandler, HTTPEvent } from "h3";
import type { TransactionOptions } from "unstorage";
import type {
  CacheEntry,
  CacheOptions,
  CachedEventHandlerOptions,
  ResponseCacheEntry,
} from "nitro/types";

function defaultCacheOptions() {
  return {
    name: "_",
    base: "/cache",
    swr: true,
    maxAge: 1,
  } as const;
}

type ResolvedCacheEntry<T> = CacheEntry<T> & { value: T };

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
    event?: HTTPEvent
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
          useNitroApp().captureError?.(error, { event, tags: ["cache"] });
        })) as unknown) || {};

    // https://github.com/nitrojs/nitro/issues/2160
    if (typeof entry !== "object") {
      entry = {};
      const error = new Error("Malformed data read from cache.");
      console.error("[cache]", error);
      useNitroApp().captureError?.(error, { event, tags: ["cache"] });
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
        if (entry.value !== undefined && (opts.staleMaxAge || 0) >= 0 && opts.swr === false) {
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
              useNitroApp().captureError?.(error, { event, tags: ["cache"] });
            });
          if (typeof event?.req?.waitUntil === "function") {
            event.req.waitUntil(promise);
          }
        }
      }
    };

    const _resolvePromise = expired ? _resolve() : Promise.resolve();

    if (entry.value === undefined) {
      await _resolvePromise;
    } else if (expired && event && event.req.waitUntil) {
      event.req.waitUntil(_resolvePromise);
    }

    if (opts.swr && validate(entry) !== false) {
      _resolvePromise.catch((error) => {
        console.error(`[cache] SWR handler error.`, error);
        useNitroApp().captureError?.(error, { event, tags: ["cache"] });
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
      args[0] && isHTTPEvent(args[0]) ? args[0] : undefined
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

export function defineCachedHandler(
  handler: EventHandler,
  opts: CachedEventHandlerOptions = defaultCacheOptions()
): EventHandler {
  const variableHeaderNames = (opts.varies || [])
    .filter(Boolean)
    .map((h) => h.toLowerCase())
    .sort();

  const _opts: CacheOptions<ResponseCacheEntry> = {
    ...opts,
    shouldBypassCache: (event) => {
      return event.req.method !== "GET" && event.req.method !== "HEAD";
    },
    getKey: async (event: H3Event) => {
      // Custom user-defined key
      const customKey = await opts.getKey?.(event);
      if (customKey) {
        return escapeKey(customKey);
      }
      // Auto-generated key
      const _path = event.url.pathname + event.url.search;
      let _pathname: string;
      try {
        _pathname = escapeKey(decodeURI(parseURL(_path).pathname)).slice(0, 16) || "index";
      } catch {
        _pathname = "-";
      }
      const _hashedPath = `${_pathname}.${hash(_path)}`;
      const _headers = variableHeaderNames
        .map((header) => [header, event.req.headers.get(header)])
        .map(([name, value]) => `${escapeKey(name as string)}.${hash(value)}`);
      return [_hashedPath, ..._headers].join(":");
    },
    validate: (entry) => {
      if (!entry.value) {
        return false;
      }
      if (entry.value.status >= 400) {
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
      return true;
    },
    group: opts.group || "nitro/handlers",
    integrity: opts.integrity || hash([handler, opts]),
  };

  const _cachedHandler = cachedFunction<ResponseCacheEntry>(async (event: H3Event) => {
    // Filter non variable headers
    const filteredHeaders = [...event.req.headers.entries()].filter(
      ([key]) => !variableHeaderNames.includes(key.toLowerCase())
    );

    try {
      const originalReq = event.req;
      // @ts-expect-error assigning to publicly readonly property
      event.req = new Request(event.req.url, {
        method: event.req.method,
        headers: filteredHeaders,
      });
      // Inherit srvx context
      event.req.runtime = originalReq.runtime;
      event.req.waitUntil = originalReq.waitUntil;
    } catch (error) {
      console.error("[cache] Failed to filter headers:", error);
    }

    // Call handler
    const rawValue = await handler(event);
    const res = await toResponse(rawValue, event);

    // Stringified body
    // TODO: support binary responses
    const body = await res.text();

    if (!res.headers.has("etag")) {
      res.headers.set("etag", `W/"${hash(body)}"`);
    }

    if (!res.headers.has("last-modified")) {
      res.headers.set("last-modified", new Date().toUTCString());
    }

    const cacheControl = [];
    if (opts.swr) {
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
      res.headers.set("cache-control", cacheControl.join(", "));
    }

    const cacheEntry: ResponseCacheEntry = {
      status: res.status,
      statusText: res.statusText,
      headers: Object.fromEntries(res.headers.entries()),
      body,
    };

    return cacheEntry;
  }, _opts);

  return defineHandler(async (event) => {
    // Headers-only mode
    if (opts.headersOnly) {
      // TODO: Send SWR too
      if (handleCacheHeaders(event, { maxAge: opts.maxAge })) {
        return;
      }
      return handler(event);
    }

    // Call with cache
    const response = (await _cachedHandler(event))!;

    // Check for cache headers
    if (
      handleCacheHeaders(event, {
        modifiedTime: new Date(response.headers["last-modified"] as string),
        etag: response.headers.etag as string,
        maxAge: opts.maxAge,
      })
    ) {
      return;
    }

    // Send Response
    return new FastResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  });
}
