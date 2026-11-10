import "./_runtime_warn.ts";
import type { PublicAsset } from "nitro/types";

// Only the ids without `serveStatic`. Entries without a plain file have no `etag`, `mtime` and `size`.
const assets = {} as
  | Record<string, Omit<PublicAsset, "etag" | "mtime" | "size"> & Partial<PublicAsset>>
  | Set<string>;

export default assets;
