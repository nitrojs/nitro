import type { Storage, StorageValue } from "unstorage";
import { prefixStorage } from "unstorage";
import { storage } from "#nitro-internal-virtual/storage";

export function useStorage<T extends StorageValue = StorageValue>(
  base = ""
): Storage<T> {
  return (base
    ? prefixStorage(storage, base)
    : storage) as unknown as Storage<T>;
}
