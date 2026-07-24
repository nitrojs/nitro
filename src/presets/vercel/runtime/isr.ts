export const ISR_URL_PARAM = "__isr_route";

export function isrRouteRewrite(
  reqUrl: string,
  xNowRouteMatches: string | null
): [pathname: string, search: string] | undefined {
  const queryIndex = reqUrl.indexOf("?");
  const reqParams =
    queryIndex === -1 ? new URLSearchParams() : new URLSearchParams(reqUrl.slice(queryIndex + 1));

  // The ISR routing param is carried by `x-now-route-matches` when Vercel
  // rewrites via the route regex, otherwise it lives on the request URL.
  // `URLSearchParams` already percent-decodes the value once; decoding again
  // would over-decode encoded slugs and throw `URIError` on a literal `%`.
  const isrURL = xNowRouteMatches
    ? new URLSearchParams(xNowRouteMatches).get(ISR_URL_PARAM)
    : reqParams.get(ISR_URL_PARAM);
  if (!isrURL) return;

  // Preserve `allowQuery` params, which Vercel forwards onto the rewritten
  // request URL. `x-now-route-matches` is intentionally not merged in: it
  // carries the route regex capture groups (named like `slug`, numeric like
  // `0`), not user query, and merging them would pollute the render and the
  // shared ISR cache entry.
  reqParams.delete(ISR_URL_PARAM);
  return [isrURL, reqParams.toString()];
}
