import type { Storage, StorageValue } from "unstorage";
import { prefixStorage } from "unstorage";
import { initStorage } from "#nitro/virtual/storage";

export function useStorage<T extends StorageValue = StorageValue>(base = ""): Storage<T> {
  const storage = ((useStorage as any)._storage ??= initStorage());
  return (base ? prefixStorage(storage, base) : storage) as unknown as Storage<T>;
}
