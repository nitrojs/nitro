// @ts-nocheck TODO: Remove after removing polyfills
import "#nitro/virtual/polyfills";
import { useNitroApp } from "nitro/app";
import { hasProtocol, joinURL } from "ufo";

// Types are reverse engineered from runtime

interface ExecuteRequest {
  url: URL;
  body?: ReadableStream;
  bodyUsed: boolean;
  headers: Headers;
  getMethod: () => string;
}

interface FetchEvent extends Event {
  request: ExecuteRequest;
  respondWith(response: Promise<Response> | Response): Promise<Response>;
  waitUntil: (promise: Promise<any>) => void;
}

const nitroApp = useNitroApp();

// Use plain handler as winterjs Web API is incomplete
// TODO: Migrate to toWebHandler
const _handler = toPlainHandler(nitroApp.h3App);

async function _handleEvent(event: FetchEvent) {
  try {
    const res = await _handler({
      path:
        event.request.url.pathname +
        (event.request.url.search ? `?${event.request.url.search}` : ""),
      method: event.request.getMethod() || "GET",
      body: event.request.body,
      headers: event.request.headers,
      context: {
        waitUntil: (promise: Promise<any>) => event.waitUntil(promise),
        _platform: {
          winterjs: {
            event,
          },
        },
      },
    });
    const body = typeof res.body === "string" ? res.body : await toBuffer(res.body as any);
    return new Response(body, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    });
  } catch (error: unknown) {
    const errString = (error as Error)?.message + "\n" + (error as Error)?.stack;
    console.error(errString);
    return new Response(errString, { status: 500 });
  }
}

addEventListener("fetch" as any, async (event: FetchEvent) => {
  event.respondWith(await _handleEvent(event));
});

// ------------------------------
// Polyfills for missing APIs
// ------------------------------

function toBuffer(data: ReadableStream): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    data
      .pipeTo(
        new WritableStream({
          write(chunk) {
            chunks.push(chunk);
          },
          close() {
            resolve(Buffer.concat(chunks));
          },
          abort(reason) {
            reject(reason);
          },
        })
      )
      .catch(reject);
  });
}

// Headers.entries
if (!Headers.prototype.entries) {
  // @ts-ignore
  Headers.prototype.entries = function () {
    return [...this];
  };
}

// URL.pathname
if (!URL.prototype.pathname) {
  Object.defineProperty(URL.prototype, "pathname", {
    get() {
      return this.path || "/";
    },
  });
}

// URL constructor (relative support)
const _URL = globalThis.URL;
globalThis.URL = class URL extends _URL {
  constructor(url: string | URL, base: string | URL) {
    if (!base || hasProtocol(url)) {
      super(url);
      return;
    }
    super(joinURL(base, url));
  }
};

// Response (avoid Promise body)
const _Response = globalThis.Response;
globalThis.Response = class Response extends _Response {
  _body: BodyInit;

  constructor(body, init) {
    super(body, init);
    this._body = body;
  }

  get body() {
    // TODO: Return ReadableStream (should be iterable)
    return this._body as any;
  }
};
