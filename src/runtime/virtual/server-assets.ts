import "./_runtime_warn.ts";
import { createStorage, type Storage } from "unstorage";

import type { AssetMeta } from "nitro/types";

export const assets: Storage = createStorage();

export function readAsset<T = any>(_id: string): Promise<T> {
  return Promise.resolve({} as T);
}

export function statAsset(_id: string): Promise<AssetMeta> {
  return Promise.resolve({});
}

export function getKeys(): Promise<string[]> {
  return Promise.resolve([]);
}
