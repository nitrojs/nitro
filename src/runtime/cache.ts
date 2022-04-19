import { hash } from 'ohash'
import { H3Response, toEventHandler, handleCacheHeaders, defineEventHandler, createEvent } from 'h3'
import type { CompatibilityEventHandler, CompatibilityEvent } from 'h3'
import { useStorage } from '#nitro'

export interface CacheEntry<T=any> {
  value?: T
  expires?: number
  mtime?: number
  integrity?: string
}

export interface CachifyOptions<T = any> {
  name?: string;
  getKey?: (...args: any[]) => string;
  transform?: (entry: CacheEntry<T>, ...args: any[]) => any;
  group?: string;
  integrity?: any;
  magAge?: number;
  swr?: boolean;
  staleMaxAge?: number;
  base?: string;
}

const defaultCacheOptions = {
  name: '_',
  base: '/cache',
  swr: true,
  magAge: 1
}

export function defineCachedFunction <T=any> (fn: ((...args) => T | Promise<T>), opts: CachifyOptions<T>) {
  opts = { ...defaultCacheOptions, ...opts }

  const pending: { [key: string]: Promise<T> } = {}

  // Normalize cache params
  const group = opts.group || 'nitro'
  const name = opts.name || fn.name || '_'
  const integrity = hash([opts.integrity, fn, opts])

  async function get (key: string, resolver: () => T | Promise<T>): Promise<CacheEntry<T>> {
    const cacheKey = [opts.base, group, name, key].filter(Boolean).join(':').replace(/:\/$/, ':index')
    const entry: CacheEntry<T> = await useStorage().getItem(cacheKey) as any || {}

    const ttl = (opts.magAge ?? opts.magAge ?? 0) * 1000
    if (ttl) {
      entry.expires = Date.now() + ttl
    }

    const expired = (entry.integrity !== integrity) || (ttl && (Date.now() - (entry.mtime || 0)) > ttl)

    const _resolve = async () => {
      if (!pending[key]) {
        pending[key] = Promise.resolve(resolver())
      }
      entry.value = await pending[key]
      entry.mtime = Date.now()
      entry.integrity = integrity
      delete pending[key]
      useStorage().setItem(cacheKey, entry).catch(error => console.error('[nitro] [cache]', error))
    }

    const _resolvePromise = expired ? _resolve() : Promise.resolve()

    if (opts.swr && entry.value) {
      // eslint-disable-next-line no-console
      _resolvePromise.catch(console.error)
      return Promise.resolve(entry)
    }

    return _resolvePromise.then(() => entry)
  }

  return async (...args) => {
    const key = (opts.getKey || getKey)(...args)
    const entry = await get(key, () => fn(...args))
    let value = entry.value
    if (opts.transform) {
      value = await opts.transform(entry, ...args) || value
    }
    return value
  }
}

export const cachedFunction = defineCachedFunction

function getKey (...args: string[]) {
  return args.length ? hash(args, {}) : ''
}

export interface ResponseCacheEntry {
  body: H3Response
  code: number
  headers: Record<string, string | number | string[]>
}

export function defineCachedEventHandler (handler: CompatibilityEventHandler, opts: Omit<CachifyOptions, 'getKey'> = defaultCacheOptions) {
  const _opts: CachifyOptions<ResponseCacheEntry> = {
    ...opts,
    getKey: (event) => {
      return event.req.originalUrl || event.req.url
    },
    group: opts.group || 'nitro/handlers',
    integrity: [
      opts.integrity,
      handler
    ]
  }

  const _handler = toEventHandler(handler)
  const _cachedHandler = cachedFunction<ResponseCacheEntry>(async (incomingEvent: CompatibilityEvent) => {
    // Create proxies to avoid sharing state with user request
    const reqProxy = cloneWithProxy(incomingEvent.req, { headers: {} })
    const resHeaders: Record<string, number | string | string[]> = {}
    const resProxy = cloneWithProxy(incomingEvent.res, {
      statusCode: 200,
      getHeader (name) { return resHeaders[name] },
      setHeader (name, value) { resHeaders[name] = value as any; return this },
      getHeaderNames () { return Object.keys(resHeaders) },
      hasHeader (name) { return name in resHeaders },
      removeHeader (name) { delete resHeaders[name] },
      getHeaders () { return resHeaders }
    })

    // Call handler
    const event = createEvent(reqProxy, resProxy)
    const body = await _handler(event)

    // Collect cachable headers
    const headers = event.res.getHeaders()
    headers.Etag = `W/"${hash(body)}"`
    headers['Last-Modified'] = new Date().toUTCString()
    const cacheControl = []
    if (opts.swr) {
      if (opts.magAge) {
        cacheControl.push(`s-maxage=${opts.magAge}`)
      }
      if (opts.staleMaxAge) {
        cacheControl.push(`stale-while-revalidate=${opts.staleMaxAge}`)
      } else {
        cacheControl.push('stale-while-revalidate')
      }
    } else if (opts.magAge) {
      cacheControl.push(`max-age=${opts.magAge}`)
    }
    if (cacheControl.length) {
      headers['Cache-Control'] = cacheControl.join(', ')
    }

    // Create cache entry for response
    const cacheEntry: ResponseCacheEntry = {
      code: event.res.statusCode,
      headers,
      body
    }

    return cacheEntry
  }, _opts)

  return defineEventHandler(async (event) => {
    // Call with cache
    const response = await _cachedHandler(event)

    // Don't continue if response is already handled by user
    if (event.res.headersSent || event.res.writableEnded) {
      return response.body
    }

    // Check for cache headers
    if (handleCacheHeaders(event, {
      modifiedTime: new Date(response.headers['Last-Modified'] as string),
      etag: response.headers.etag as string,
      maxAge: opts.magAge
    })) {
      return
    }

    // Send status and headers
    event.res.statusCode = response.code
    for (const name in response.headers) {
      event.res.setHeader(name, response.headers[name])
    }

    // Send body
    return response.body
  })
}

function cloneWithProxy<T extends object = any> (obj: T, overrides: Partial<T>): T {
  return new Proxy(obj, {
    get (target, property, receiver) {
      if (property in overrides) {
        return overrides[property]
      }
      return Reflect.get(target, property, receiver)
    },
    set (target, property, value, receiver) {
      if (property in overrides) {
        overrides[property] = value
        return true
      }
      return Reflect.set(target, property, value, receiver)
    }
  })
}

export const cachedEventHandler = defineCachedEventHandler
