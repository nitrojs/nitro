const SHARED_CACHE_DIRECTIVE = /(?:^|,)\s*s-maxage=/i;

export function addNetlifyVaryHeader(headers: Headers): void {
  if (headers.has("Netlify-Vary")) {
    return;
  }
  const cacheControl = headers.get("Cache-Control");
  if (cacheControl && SHARED_CACHE_DIRECTIVE.test(cacheControl)) {
    headers.set("Netlify-Vary", "query");
  }
}
