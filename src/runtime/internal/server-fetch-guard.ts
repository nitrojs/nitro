/**
 * Recursion guard for `serverFetch`.
 *
 * A renderer template can call `serverFetch("/api")`, and if `/api` has no
 * route it falls back to the renderer again, which calls `serverFetch("/api")`
 * again — each hop is a brand new `Request`, so nothing in the request context
 * links them. Counting how many calls for the same method + URL are in flight
 * catches that loop while leaving independent concurrent requests alone until
 * they collide at the limit.
 */
export const MAX_SERVER_FETCH_DEPTH = 10;

const inFlight = new Map<string, number>();

export function serverFetchKey(request: { method: string; url: string }): string {
  return `${request.method} ${request.url}`;
}

/**
 * Mark one call for `key` as in flight and return the matching release
 * function. Throws when the same target is already nested too deeply.
 */
export function beginServerFetch(key: string): () => void {
  const depth = (inFlight.get(key) ?? 0) + 1;
  if (depth > MAX_SERVER_FETCH_DEPTH) {
    throw new Error(
      `[nitro] serverFetch recursion limit exceeded (${MAX_SERVER_FETCH_DEPTH}) for ${key}. ` +
        `This usually means the requested route does not exist and falls back to a template that calls serverFetch for the same URL.`
    );
  }
  inFlight.set(key, depth);

  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    const remaining = (inFlight.get(key) ?? 1) - 1;
    if (remaining > 0) {
      inFlight.set(key, remaining);
    } else {
      inFlight.delete(key);
    }
  };
}
