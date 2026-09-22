import type { Storage, StorageValue } from "unstorage";
import { prefixStorage } from "unstorage";
import { initStorage } from "#nitro/virtual/storage";

export function useKV<T extends StorageValue = StorageValue>(base = ""): Storage<T> {
  const storage = ((useKV as any)._storage ??= initStorage());
  return (base ? prefixStorage(storage, base) : storage) as unknown as Storage<T>;
}

/** @deprecated Use `useKV` from `nitro/kv` instead. */
export const useStorage: typeof useKV = useKV;
