/**
 * Recursion guard for `serverFetch`.
 *
 * A renderer template can call `serverFetch("/api")`, and if `/api` has no
 * route it falls back to the renderer again, which calls `serverFetch("/api")`
 * again — each hop is a brand new `Request`, so nothing in the request context
 * links them. Depth is therefore tracked per async call chain: concurrent
 * requests for the same URL are independent chains and never add up, while
 * nested calls inherit the depth of the chain that started them.
 */
export const MAX_SERVER_FETCH_DEPTH = 10;

type Depths = Map<string, number>;
type AsyncLocalStorageLike = {
  getStore: () => Depths | undefined;
  run: <T>(store: Depths, fn: () => T) => T;
};

// Node and worker runtimes with `nodejs_compat` expose async_hooks through
// `process.getBuiltinModule`; other runtimes fall back to in-flight counting.
const AsyncLocalStorage = (
  globalThis as {
    process?: {
      getBuiltinModule?: (id: string) => { AsyncLocalStorage?: new () => AsyncLocalStorageLike };
    };
  }
).process?.getBuiltinModule?.("async_hooks")?.AsyncLocalStorage;

const storage = AsyncLocalStorage ? new AsyncLocalStorage() : undefined;

const inFlight = new Map<string, number>();

export function serverFetchKey(request: { method: string; url: string }): string {
  return `${request.method} ${request.url}`;
}

/**
 * Run `fn` as one `serverFetch` hop for `key`, rejecting the call once the
 * same target is nested more than `MAX_SERVER_FETCH_DEPTH` times.
 */
export function withServerFetchGuard<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (storage) {
    const parent = storage.getStore();
    const depth = (parent?.get(key) ?? 0) + 1;
    if (depth > MAX_SERVER_FETCH_DEPTH) {
      return Promise.reject(recursionError(key));
    }
    // A copy per hop: sibling calls of one chain stay independent of each other
    const depths = new Map(parent);
    depths.set(key, depth);
    try {
      return storage.run(depths, fn);
    } catch (error) {
      return Promise.reject(error);
    }
  }
  return withInFlightGuard(key, fn);
}

function recursionError(key: string): Error {
  return new Error(
    `[nitro] serverFetch recursion limit exceeded (${MAX_SERVER_FETCH_DEPTH}) for ${key}. ` +
      `This usually means the requested route does not exist and falls back to a template that calls serverFetch for the same URL.`
  );
}

// Without async context there is no way to tell chains apart, so depth is
// approximated by how many calls for the same target are still in flight.
function withInFlightGuard<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const depth = (inFlight.get(key) ?? 0) + 1;
  if (depth > MAX_SERVER_FETCH_DEPTH) {
    return Promise.reject(recursionError(key));
  }
  inFlight.set(key, depth);
  let released = false;
  const release = () => {
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
  let result: Promise<T>;
  try {
    result = fn();
  } catch (error) {
    release();
    return Promise.reject(error);
  }
  return result.finally(release);
}
