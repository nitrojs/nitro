import type { Storage, StorageValue } from "unstorage";
import { prefixStorage } from "unstorage";
import { initKV } from "#nitro/virtual/kv";

/**
 * Access the key-value storage layer (powered by unstorage), optionally scoped to a `base` prefix.
 *
 * @see https://nitro.build/docs/storage
 */
export function useKV<T extends StorageValue = StorageValue>(base = ""): Storage<T> {
  const storage = ((useKV as any)._kv ??= initKV());
  return (base ? prefixStorage(storage, base) : storage) as unknown as Storage<T>;
}

/** @deprecated Use `useKV` from `nitro/kv` instead. */
export const useStorage: typeof useKV = useKV;
