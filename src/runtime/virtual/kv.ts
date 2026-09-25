import "./_runtime_warn.ts";
import { type Storage, createStorage } from "unstorage";

export function initKV(): Storage {
  return createStorage();
}
