// Shared by the production wrapper and the dev worker: `export default { fetch }` wins over a named
// `fetch` export. Handlers are looked up on every call to keep `this` and pick up reassignments.
export function resolveServiceFetch(mod, { name, entry }) {
  const fetch = resolveServiceExport(mod, "fetch");
  if (!fetch) {
    throw new TypeError(
      `[nitro] Service "${name}" (${entry}) does not export a \`fetch\` handler (expected \`export default { fetch }\` or \`export function fetch\`).`
    );
  }
  return fetch;
}

export function resolveServiceExport(mod, key) {
  const service = mod?.default ?? mod;
  if (typeof service?.[key] === "function") {
    return (...args) => service[key](...args);
  }
  if (service !== mod && typeof mod[key] === "function") {
    return (...args) => mod[key](...args);
  }
}

// Loads the entry on first use; a rejected load is not kept so the next request retries it.
export function lazyService(loader, ctx) {
  let promise, handler;
  return {
    fetch(req) {
      if (handler) {
        return handler(req);
      }
      promise ??= loader()
        .then((mod) => (handler = resolveServiceFetch(mod, ctx)))
        .catch((error) => {
          promise = undefined;
          throw error;
        });
      return promise.then((handler) => handler(req));
    },
  };
}
