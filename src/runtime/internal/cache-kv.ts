import type { StorageInterface } from "ocache";
import { useKV } from "./kv.ts";

/** Cache storage backed by the Nitro KV storage layer (`useKV()`). */
export function createKVCacheStorage(): StorageInterface {
  const storage = useKV();
  return {
    get: (key) => storage.getItem(key) as any,
    set: (key, value, opts) =>
      storage.setItem(key, value as any, opts?.ttl ? { ttl: opts.ttl } : undefined),
  };
}
