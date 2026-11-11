// Local copy of the experimental `srvx/scriptc` adapter (https://github.com/h3js/srvx/pull/363),
// with the srvx internals it uses inlined. Remove once srvx ships it.

import {
  createServer,
  type IncomingMessage,
  type Server as NodeHttpServer,
  type ServerResponse,
} from "node:http";
import type { Server, ServerHandler, ServerMiddleware, ServerOptions } from "srvx";

export const FastURL: typeof globalThis.URL = URL;

// `new` through a binding that holds the native `Response` class throws under scriptc
export const FastResponse: typeof globalThis.Response = /* @__PURE__ */ (() => {
  type Args = ConstructorParameters<typeof Response>;
  function FastResponse(body?: Args[0], init?: Args[1]): Response {
    return new Response(body, init);
  }
  FastResponse.json = (data: unknown, init?: ResponseInit) => Response.json(data, init);
  FastResponse.redirect = (url: string | URL, status?: number) => Response.redirect(url, status);
  FastResponse.error = () => Response.error();
  return FastResponse as unknown as typeof globalThis.Response;
})();

export function serve(options: ServerOptions): Server {
  return new ScriptcServer(options);
}

class ScriptcServer implements Server {
  readonly runtime = "scriptc" as Server["runtime"];
  readonly options: Server["options"];
  readonly fetch: ServerHandler;
  readonly waitUntil: Server["waitUntil"];

  #server: NodeHttpServer;
  #pending = new Set<Promise<void>>();
  #listening: Promise<this> | undefined;

  constructor(options: ServerOptions) {
    this.options = { ...options, middleware: [...(options.middleware || [])] };

    for (const plugin of options.plugins || []) plugin(this);
    errorPlugin(this);

    const pending = this.#pending;
    this.waitUntil = (promise: Promise<unknown>): void => {
      let tracked: Promise<void> | undefined;
      tracked = promise
        .then(
          () => {},
          (error: unknown) => console.error(error)
        )
        .finally(() => {
          if (tracked) pending.delete(tracked);
        });
      pending.add(tracked);
    };

    const fetchHandler = wrapFetch(this);
    this.fetch = fetchHandler;

    const silent = this.options.silent;
    if (!silent && options.tls) {
      console.warn("[srvx] HTTPS is not supported with scriptc yet: serving HTTP.");
    }
    if (!silent && (options.node as { path?: string } | undefined)?.path) {
      console.warn("[srvx] UNIX sockets are not supported with scriptc yet: listening on TCP.");
    }
    this.#server = createServer({}, (req: IncomingMessage, res: ServerResponse) => {
      void handleRequest(fetchHandler, req, res, silent);
    });

    if (!options.manual) {
      this.serve().catch((error: unknown) => {
        if (!silent) console.error("[srvx] Failed to start server:", error);
      });
    }
  }

  serve(): Promise<this> {
    if (this.#listening) return this.#listening;
    const server = this.#server;
    const { port, hostname } = resolvePortAndHost(this.options);
    this.#listening = new Promise<this>((resolve, reject) => {
      let settled = false;
      server.on("error", (error: Error) => {
        if (settled) return;
        settled = true;
        reject(error);
      });
      server.listen(port, hostname, () => {
        settled = true;
        printListening(this.options, this.url);
        resolve(this);
      });
    });
    return this.#listening;
  }

  get url(): string | undefined {
    const server = this.#server;
    if (!server.listening) return;
    const addr = server.address();
    if (!addr || typeof addr === "string") return;
    return fmtURL(addr.address, addr.port);
  }

  async ready(): Promise<this> {
    if (this.#listening) await this.#listening;
    return this;
  }

  async close(closeActiveConnections?: boolean): Promise<void> {
    const server = this.#server;
    if (closeActiveConnections) server.closeAllConnections();
    // An explicit argument: scriptc 0.4.12 rejects `resolve()` once bundling drops `<void>`
    const closed = new Promise<void>((resolve) => {
      if (!server.listening) return resolve(undefined);
      server.close(() => resolve(undefined));
    });
    const pending = this.#pending;
    while (pending.size > 0) await Promise.all(Array.from(pending));
    await closed;
  }
}

async function handleRequest(
  fetchHandler: ServerHandler,
  req: IncomingMessage,
  res: ServerResponse,
  silent: boolean | undefined
): Promise<void> {
  let request: Request;
  try {
    request = toRequest(req, res);
  } catch {
    res.statusCode = 400;
    res.end();
    return;
  }
  let response: Response;
  try {
    response = await fetchHandler(request);
  } catch (error) {
    if (!silent) console.error("[srvx] Unhandled error in fetch handler:", error);
    return sendError(res);
  }
  try {
    await sendResponse(req, res, response);
  } catch (error) {
    if (!silent) console.error("[srvx] Failed to send response:", error);
    sendError(res);
  }
}

const INVALID_HOST_RE = /[\s/?#@\\]/;

function toRequest(req: IncomingMessage, res: ServerResponse): Request {
  const target = req.url || "/";
  let url: string;
  if (target[0] === "/") {
    const host = req.headers.host || "localhost";
    if (INVALID_HOST_RE.test(host)) throw new TypeError("Invalid host header");
    url = new URL(`http://${host}${target}`).href;
  } else if (target.startsWith("http://") || target.startsWith("https://")) {
    url = new URL(target).href;
  } else {
    throw new TypeError("Invalid request target");
  }

  const method = req.method || "GET";
  const headers = new Headers();
  const raw = req.rawHeaders;
  for (let i = 0; i < raw.length; i += 2) headers.append(raw[i], raw[i + 1]);

  const abort = new AbortController();
  res.on("close", () => {
    if (!res.writableFinished) abort.abort();
  });

  if (method === "GET" || method === "HEAD") {
    return new Request(url, { method, headers, signal: abort.signal });
  }
  return new Request(url, {
    method,
    headers,
    signal: abort.signal,
    body: toBodyStream(req, res),
    duplex: "half",
  } as RequestInit);
}

function toBodyStream(req: IncomingMessage, res: ServerResponse): ReadableStream<Uint8Array> {
  let done = false;
  const discard = () => {
    if (done) return;
    done = true;
    req.resume();
  };
  res.on("finish", discard);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      req.on("data", (chunk: Uint8Array) => {
        if (done) return;
        controller.enqueue(chunk);
        if ((controller.desiredSize || 0) <= 0) req.pause();
      });
      req.on("end", () => {
        if (done) return;
        done = true;
        controller.close();
      });
      req.on("error", (error: Error) => {
        if (done) return;
        done = true;
        controller.error(error);
      });
    },
    pull() {
      if (!done) req.resume();
    },
    cancel() {
      discard();
    },
  });
}

async function sendResponse(
  req: IncomingMessage,
  res: ServerResponse,
  response: Response
): Promise<void> {
  res.statusCode = response.status;
  if (response.statusText) res.statusMessage = response.statusText;
  response.headers.forEach((value: string, key: string) => {
    if (key !== "set-cookie") res.setHeader(key, value);
  });
  const cookies = response.headers.getSetCookie();
  if (cookies.length > 0) res.setHeader("set-cookie", cookies);

  const body = response.body;
  if (!body || req.method === "HEAD" || isNullBodyStatus(response.status)) {
    if (body) body.cancel().catch(() => {});
    res.end();
    return;
  }

  const reader = body.getReader();
  let closed = false;
  res.on("close", () => {
    closed = true;
    reader.cancel().catch(() => {});
  });
  while (!closed) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) res.write(value);
  }
  res.end();
}

function sendError(res: ServerResponse): void {
  if (res.writableEnded) return;
  if (res.headersSent) {
    res.destroy();
    return;
  }
  for (const name of res.getHeaderNames()) res.removeHeader(name);
  res.statusCode = 500;
  res.statusMessage = "Internal Server Error";
  res.end();
}

function wrapFetch(server: Server): ServerHandler {
  let composed: ServerHandler = server.options.fetch;
  const middleware: ServerMiddleware[] = server.options.middleware || [];
  for (let i = middleware.length - 1; i >= 0; i--) {
    const mw = middleware[i]!;
    const next = composed;
    composed = (request) => mw(request, () => next(request));
  }
  return composed;
}

function errorPlugin(server: Server): void {
  const errorHandler = server.options.error;
  if (!errorHandler) return;
  server.options.middleware!.unshift(async (_req, next) => {
    try {
      return await next();
    } catch (error) {
      return errorHandler(error as Error);
    }
  });
}

function resolvePortAndHost(opts: ServerOptions): { port: number; hostname: string | undefined } {
  const env = globalThis.process?.env || {};
  const _port = opts.port ?? env.PORT ?? 3000;
  const port = typeof _port === "number" ? _port : Number.parseInt(_port, 10);
  if (Number.isNaN(port) || port < 0 || port > 65_535) {
    throw new RangeError(`Port must be a number between 0 and 65535 (got "${_port}").`);
  }
  return { port, hostname: opts.hostname ?? env.HOST };
}

function fmtURL(host: string, port: number): string | undefined {
  if (!host || !port) return;
  if (host.includes(":")) host = `[${host}]`;
  return `http://${host}:${port}/`;
}

function printListening(opts: ServerOptions, url: string | undefined): void {
  if (!url || opts.silent) return;
  console.log(`➜ Listening on: ${url.replace(/\/\/(\[::\]|0\.0\.0\.0):/, "//localhost:")}`);
}

function isNullBodyStatus(status: number): boolean {
  return status === 101 || status === 204 || status === 205 || status === 304;
}
