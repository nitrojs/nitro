import "./_runtime_warn.ts";
import { type Storage, createStorage } from "unstorage";

export function initStorage(): Storage {
  return createStorage();
}
