export const ISR_URL_PARAM = "__isr_route";

export function isrRouteRewrite(
  reqUrl: string,
  xNowRouteMatches: string | null
): [pathname: string, search: string] | undefined {
  const queryIndex = reqUrl.indexOf("?");
  const reqParams =
    queryIndex === -1 ? new URLSearchParams() : new URLSearchParams(reqUrl.slice(queryIndex + 1));

  // The ISR routing param is carried by `x-now-route-matches` when Vercel
  // rewrites via the route regex, and by the request URL otherwise. The header
  // is an undocumented contract that has changed shape before (#4446), so fall
  // back to the request URL when the header arrives without the param: the
  // rewrite writes the identical value into both carriers.
  // `URLSearchParams` already percent-decodes the value once; decoding again
  // would over-decode encoded slugs and throw `URIError` on a literal `%`.
  const isrURL =
    (xNowRouteMatches ? new URLSearchParams(xNowRouteMatches).get(ISR_URL_PARAM) : null) ??
    reqParams.get(ISR_URL_PARAM);
  if (!isrURL) return;

  // Preserve `allowQuery` params, which Vercel forwards onto the rewritten
  // request URL. `x-now-route-matches` is intentionally not merged in: it
  // carries the route regex capture groups (named like `slug`, numeric like
  // `0`), not user query, and merging them would pollute the render and the
  // shared ISR cache entry.
  reqParams.delete(ISR_URL_PARAM);
  return [isrURL, reqParams.toString()];
}
