import type { Storage } from "unstorage";

export function initStorage(): Storage {
  throw new Error("Storage is only available in a Nitro runtime.");
}
