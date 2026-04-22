// Check whether `pathname`, after canonicalization, stays within `base`.
// Prevents match/forward differentials where an encoded traversal like `..%2f`
// bypasses the `/**` scope at match time but escapes the base once the
// upstream decodes `%2f` → `/` (GHSA-5w89-w975-hf9q).
//
// WHATWG URL keeps `%2F` and `%5C` opaque in paths, so we pre-decode those,
// then let `new URL` resolve `.`/`..`/`%2E%2E` segments and normalize `\`.
export function isPathInScope(pathname: string, base: string): boolean {
  let canonical: string;
  try {
    const pre = pathname.replace(/%2f/gi, "/").replace(/%5c/gi, "\\");
    canonical = new URL(pre, "http://_").pathname;
  } catch {
    return false;
  }
  return !base || canonical === base || canonical.startsWith(base + "/");
}
