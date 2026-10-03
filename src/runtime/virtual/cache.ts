import "./_runtime_warn.ts";
import { createMemoryStorage } from "ocache";
import type { StorageInterface } from "ocache";
import type { CacheOptions, CachedEventHandlerOptions } from "nitro/types";

export const cacheFunctionDefaults: Partial<CacheOptions> = {};

export const cacheHandlerDefaults: Partial<CachedEventHandlerOptions> = {};

export function createCacheStorage(): StorageInterface {
  return createMemoryStorage();
}
