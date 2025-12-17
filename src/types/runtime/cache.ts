import type { H3Event } from "h3";

export interface CacheEntry<T = any> {
  value?: T;
  expires?: number;
  mtime?: number;
  integrity?: string;
}

export interface CacheOptions<T = any, ArgsT extends unknown[] = any[]> {
  name?: string;
  getKey?: (...args: ArgsT) => string | Promise<string>;
  transform?: (entry: CacheEntry<T>, ...args: ArgsT) => any;
  serialize?: (
    value: CacheEntry<T>,
    ...args: ArgsT
  ) => CacheEntry<T> | Promise<CacheEntry<T>>;
  validate?: (entry: CacheEntry<T>, ...args: ArgsT) => boolean;
  shouldInvalidateCache?: (...args: ArgsT) => boolean | Promise<boolean>;
  shouldBypassCache?: (...args: ArgsT) => boolean | Promise<boolean>;
  group?: string;
  integrity?: any;
  /**
   * Number of seconds to cache the response. Defaults to 1.
   */
  maxAge?: number;
  swr?: boolean;
  staleMaxAge?: number;
  base?: string;
}

export interface ResponseCacheEntry<T = any> {
  body: T | undefined;
  code: number;
  headers: Record<string, string | number | string[] | undefined>;
}

export interface CachedEventHandlerOptions<T = any> extends Omit<
  CacheOptions<ResponseCacheEntry<T>, [H3Event]>,
  "transform" | "validate"
> {
  headersOnly?: boolean;
  varies?: string[] | readonly string[];
}
