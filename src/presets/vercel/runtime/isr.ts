export const ISR_URL_PARAM = "__isr_route";

export function isrRouteRewrite(
  reqUrl: string,
  xNowRouteMatches: string | null
): string | undefined {
  if (xNowRouteMatches) {
    const isrURL = new URLSearchParams(xNowRouteMatches).get(ISR_URL_PARAM);
    if (isrURL) {
      return decodeURIComponent(isrURL);
    }
  } else {
    const queryIndex = reqUrl.indexOf("?");
    if (queryIndex !== -1) {
      const params = new URLSearchParams(reqUrl.slice(queryIndex + 1));
      const isrURL = params.get(ISR_URL_PARAM);
      if (isrURL) {
        params.delete(ISR_URL_PARAM);
        return decodeURIComponent(isrURL) + "?" + params.toString();
      }
    }
  }
}
