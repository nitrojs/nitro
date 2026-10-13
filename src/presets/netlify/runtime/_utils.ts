const SHARED_CACHE_DIRECTIVE = /(?:^|,)\s*s-maxage=/i;

export function addNetlifyVaryHeader(response: Response): Response {
  if (response.headers.has("Netlify-Vary")) {
    return response;
  }
  const cacheControl = response.headers.get("Cache-Control");
  if (!cacheControl || !SHARED_CACHE_DIRECTIVE.test(cacheControl)) {
    return response;
  }
  // `response.headers` can be immutable here (e.g. a route handler that returns a
  // fetched upstream Response as-is), in which case `.set()` throws. Build a mutable
  // copy before adding the header instead of mutating the response in place.
  const mutableResponse = new Response(response.body, response);
  mutableResponse.headers.set("Netlify-Vary", "query");
  return mutableResponse;
}
