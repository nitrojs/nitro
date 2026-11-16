import "./_runtime_warn.ts";
import { createMemoryStorage } from "ocache";
import type { StorageInterface } from "ocache";
import type { CachedFunctionOptions, CachedHandlerOptions } from "nitro/types";

export const cacheFunctionDefaults: Partial<CachedFunctionOptions> = {};

export const cacheHandlerDefaults: Partial<CachedHandlerOptions> = {};

export function createCacheStorage(): StorageInterface {
  return createMemoryStorage();
}
