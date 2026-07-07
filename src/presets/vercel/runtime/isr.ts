export const ISR_URL_PARAM = "__isr_route";

export function isrRouteRewrite(
  reqUrl: string,
  xNowRouteMatches: string | null
): [pathname: string, search: string] | undefined {
  const queryIndex = reqUrl.indexOf("?");
  if (xNowRouteMatches) {
    const matches = new URLSearchParams(xNowRouteMatches);
    const isrURL = matches.get(ISR_URL_PARAM);
    if (isrURL) {
      // Rebuild the query from both `x-now-route-matches` and the rewritten
      // request URL, skipping the ISR routing param and Vercel's numeric
      // regex-capture groups (`0`, `1`, ...). Without this, `allowQuery`
      // params (e.g. `?lang`) are dropped and the ISR cache stores the
      // bare-path document under the query-keyed entry.
      const sources =
        queryIndex === -1
          ? [matches]
          : [matches, new URLSearchParams(reqUrl.slice(queryIndex + 1))];
      const params = new URLSearchParams();
      for (const source of sources) {
        for (const [key, value] of source) {
          if (key === ISR_URL_PARAM || /^\d+$/.test(key)) continue;
          if (!params.has(key)) params.set(key, value);
        }
      }
      return [decodeURIComponent(isrURL), params.toString()];
    }
  } else if (queryIndex !== -1) {
    const reqParams = new URLSearchParams(reqUrl.slice(queryIndex + 1));
    const isrURL = reqParams.get(ISR_URL_PARAM);
    if (isrURL) {
      reqParams.delete(ISR_URL_PARAM);
      return [decodeURIComponent(isrURL), reqParams.toString()];
    }
  }
}
