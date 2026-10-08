import { useKV as _useKV } from "./internal/kv.ts";

export { useStorage } from "./internal/kv.ts";

/** @deprecated Import from `nitro/kv` instead. */
export const useKV: typeof _useKV = _useKV;
