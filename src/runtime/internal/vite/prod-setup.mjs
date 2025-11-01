export function setupVite({ services }) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = function nitroViteFetch(input, init) {
    // Only override if viteEnvName is specified
    const viteEnvName = getViteEnv(init) || getViteEnv(input);
    if (!viteEnvName) {
      return originalFetch(input, init);
    }

    // Validate viteEnv
    const viteEnv = services[viteEnvName];
    if (!viteEnv) {
      throw httpError(404);
    }

    // Normalize input (relative urls)
    if (typeof input === "string" && input[0] === "/") {
      input = new URL(input, "http://localhost");
    }

    // Clone headers and set viteEnv header
    const headers = new Headers(init?.headers || {});
    headers.set("x-vite-env", viteEnvName);

    // Normalize to Request
    if (
      !(input instanceof Request) ||
      (init && Object.keys(init).join("") !== "viteEnv")
    ) {
      input = new Request(input, init);
    }

    // Fetch via vite env
    return viteEnv.fetch(input);
  };
}

function getViteEnv(input) {
  if (!input || typeof input !== "object") {
    return;
  }
  if ("viteEnv" in input) {
    return input.viteEnv;
  }
  if (input.headers) {
    return (
      input.headers["x-vite-env"] ||
      input.headers.get?.("x-vite-env") ||
      (Array.isArray(input.headers) &&
        input.headers.find((h) => h[0].toLowerCase() === "x-vite-env")?.[1])
    );
  }
}
