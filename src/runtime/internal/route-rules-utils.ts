import { parseURL } from "ufo";

// Max percent-decoding passes (covers nested encodings like `%252f`, `%25%32%66`).
const MAX_DECODE_PASSES = 8;

const PERCENT_ESCAPE_RE = /%([\da-f]{2})/gi;
const HAS_PERCENT_ESCAPE_RE = /%[\da-f]{2}/i;

// Canonical reading of `pathname`, used only for scope checks (never forwarded).
//
// Fully percent-decodes (repeatedly, for nested encodings), treats `\` as `/`,
// drops empty and `.` segments and resolves `..`. Dropping empty segments is
// deliberately strict: an empty segment can otherwise absorb a `..` (e.g.
// `/api//..%2fadmin`), and collapsing never yields a path deeper than a
// reading that keeps them.
//
// Returns `undefined` if the path cannot be canonicalized safely.
export function canonicalizePath(pathname: string): string | undefined {
  let path = pathname;
  for (let pass = 0; HAS_PERCENT_ESCAPE_RE.test(path); pass++) {
    if (pass >= MAX_DECODE_PASSES) {
      return undefined;
    }
    path = path.replace(PERCENT_ESCAPE_RE, (_, hex) =>
      String.fromCharCode(Number.parseInt(hex, 16))
    );
  }
  const segments: string[] = [];
  for (const segment of path.replace(/\\/g, "/").split("/")) {
    if (segment === "" || segment === ".") {
      continue;
    }
    if (segment === "..") {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return "/" + segments.join("/");
}

// WHATWG reading: what `fetch` sends and what a browser follows. It resolves
// raw dot segments while keeping `%2F` opaque, so it can differ from the
// decoded reading (e.g. `/a%2fb/../../admin` → `/admin`).
function whatwgPathname(pathname: string): string | undefined {
  try {
    return new URL(pathname, "http://_").pathname;
  } catch {
    return undefined;
  }
}

// Every reading a downstream may apply. A path is only in scope if it stays
// within the base under all of them.
const READINGS: Array<(pathname: string) => string | undefined> = [
  (p) => canonicalizePath(p),
  (p) => {
    const whatwg = whatwgPathname(p);
    return whatwg === undefined ? undefined : canonicalizePath(whatwg);
  },
];

// Check whether `pathname`, after canonicalization, stays within `base`.
// Prevents match/forward differentials where an encoded traversal like `..%2f`
// bypasses the `/**` scope at match time but escapes the base once the
// downstream (proxy upstream or redirect target) decodes `%2f` → `/`
// (GHSA-5w89-w975-hf9q, GHSA-jxc8-347r-cw9m).
//
// `base` is canonicalized under the same reading, so encoded or non-canonical
// bases (e.g. `/projects/grp%2Fproj`) keep working.
export function isPathInScope(pathname: string, base: string): boolean {
  if (!base || base === "/") {
    return true;
  }
  for (const read of READINGS) {
    const canonicalBase = read(base);
    const canonical = read(pathname);
    if (canonicalBase === undefined || canonical === undefined) {
      return false;
    }
    if (canonicalBase === "/") {
      continue;
    }
    if (
      canonical !== canonicalBase &&
      !canonical.startsWith(canonicalBase + "/")
    ) {
      return false;
    }
  }
  return true;
}

// Check whether the final resolved `target` (URL or path, may include query)
// stays within the path of `targetBase` (the rule target without `/**`).
//
// The request-side check alone is not enough: the forwarded value is derived
// from the raw path via `withoutBase` + `joinURL`, which can read the path
// differently than the check did (GHSA-jxc8-347r-cw9m). Validating the final
// target closes any such differential regardless of how the tail was derived.
export function isTargetInScope(target: string, targetBase: string): boolean {
  return isPathInScope(
    parseURL(target).pathname || "/",
    parseURL(targetBase).pathname || ""
  );
}
