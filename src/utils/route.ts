// Temporary inline port of h3's internal `normalizeRoute`
// (`h3/src/utils/internal/path.ts`), which h3 applies in `on()`, `use()`,
// `mount()` and `removeRoute()` but does not export. Nitro registers into rou3
// directly and overrides h3's lookup (`h3App["~findRoute"]`), so it bypasses
// that step and has to reproduce it to match on the same strings.
//
// Delete this file and import from h3 once the util is public.

// A route pattern is a *pathname*, never a URL: `http://evil.com/admin` would
// otherwise parse as one and silently register at `/admin`, and `//admin` at
// `/` — a pattern that reads as scoped mounting a handler at the root.
const ABSOLUTE_URL_RE = /^[a-z][a-z\d+\-.]*:\/\//i;

// Characters a request's `event.url.pathname` always carries percent-encoded
// (the WHATWG path percent-encode set) and that carry no meaning in a rou3
// pattern, so encoding them here is what makes `/café/**` scope the route
// registered as `/caf%C3%A9/secret`.
//
// Deliberately *not* encoded, even though the URL serializer encodes them:
// `?` `{` `}` `^` — rou3 pattern syntax (optional params `:id?`, groups `{x}`)
// or regex operators inside a `(...)` segment. A pattern needing one of those
// as a *literal* must spell it percent-encoded (`%3F`, `%7B`, `%7D`, `%5E`).
// `\` is rou3's escape character and is likewise left alone — the URL parser
// turns it into `/`, which would rewrite `/user/:id(\d+)` to `/user/:id(/d+)`.
// Control characters are in the set on purpose: they are percent-encoded too.
const ROUTE_ENCODE_RE = /[\u0000-\u0020"#<>\u0060]|[^\u0000-\u007E]/gu;

// Percent-escapes that are *needless*: every escape whose decoded character
// survives WHATWG path serialization unchanged, minus `%2F` (decoding it would
// change how many segments the path has) and `%25` (decoding it would turn
// `%252f` into a decodable `%2f`). h3 decodes exactly this set on the way in,
// so a pattern spelling one of them has to decode too or it can never match.
const NEEDLESS_ESCAPE_SRC = String.raw`%(?:2[146-9A-E]|3[0-9ABD]|4[0-9A-F]|5[0-9ABDF]|6[1-9A-F]|7[0-9ACE])`;
const NEEDLESS_ESCAPE_RE_G = /* @__PURE__ */ new RegExp(NEEDLESS_ESCAPE_SRC, "gi");

/**
 * Canonical form of a route *pattern*, in the same shape as the
 * `event.url.pathname` it will be matched against.
 *
 * Rejects absolute URLs; everything else is treated as a pathname: a leading
 * slash is added if missing, characters the URL serializer would percent-encode
 * are encoded (minus rou3 syntax, see `ROUTE_ENCODE_RE`), needless escapes are
 * decoded, and `.`/`..` segments are resolved the way the URL parser resolves
 * them in a request path. Idempotent.
 */
export function normalizeRoute(route: string): string {
  if (ABSOLUTE_URL_RE.test(route)) {
    throw new Error(`Route patterns are pathnames, received URL: ${route}`);
  }
  if (route.charCodeAt(0) !== 47 /* / */) {
    route = `/${route}`;
  }
  // `encodeURIComponent` ignores `replace`'s extra arguments. It throws on a
  // lone surrogate, which is then reported as an invalid route rather than
  // silently substituted.
  route = canonicalPathname(route.replace(ROUTE_ENCODE_RE, encodeURIComponent as () => string));
  // A `.`/`..` segment is one the URL parser would have resolved away in a
  // request path, so a pattern carrying one could never be reached.
  return route.includes("/.") ? resolveDotSegments(route) : route;
}

function canonicalPathname(pathname: string): string {
  return pathname.replace(NEEDLESS_ESCAPE_RE_G, (m) =>
    String.fromCharCode(Number.parseInt(m.slice(1), 16))
  );
}

function resolveDotSegments(pathname: string): string {
  const out: string[] = [];
  let dot = false;
  for (const segment of pathname.split("/")) {
    dot = segment === "." || segment === "..";
    if (!dot) {
      out.push(segment);
    } else if (segment.length === 2 && out.length > 1) {
      out.pop();
    }
  }
  if (dot) {
    out.push(""); // a resolved trailing dot segment leaves a trailing slash
  }
  return out.join("/");
}
