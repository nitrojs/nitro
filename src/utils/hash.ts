import { createHash } from "node:crypto";

/**
 * Stable hash used for generated identifiers and cache keys.
 *
 * Returns a hex digest (safe to embed in JS identifiers) truncated to `length`.
 */
export function hash(input: string, length = 16): string {
  return createHash("sha256").update(input).digest("hex").slice(0, length);
}
