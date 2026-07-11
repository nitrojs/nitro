type BunServeOptions = {
  idleTimeout?: number;
  fetch: (request: Request, server: unknown) => Response | Promise<Response>;
};

const bun = (
  globalThis as typeof globalThis & {
    Bun: { serve: (options: BunServeOptions) => unknown };
  }
).Bun;
const bunServe = bun.serve;

bun.serve = (options) => {
  const fetch = options.fetch;
  options.fetch = (request, server) => {
    if (new URL(request.url).pathname === "/_bun/idle-timeout") {
      return new Response(String(options.idleTimeout));
    }
    return fetch(request, server);
  };
  return bunServe(options);
};
