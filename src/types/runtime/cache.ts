import type { HTTPEvent } from "h3";

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

export interface ResponseCacheEntry {
  status: number;
  statusText: string | undefined;
  headers: Record<string, string>;
  body: string | undefined;
}

export interface CachedEventHandlerOptions
  extends Omit<
    CacheOptions<ResponseCacheEntry, [HTTPEvent]>,
    "transform" | "validate"
  > {
  headersOnly?: boolean;
  varies?: string[] | readonly string[];
}
