import { setServerPlatform } from "@qwik.dev/core/server";
import type {
  ClientConn,
  ServerRenderOptions,
  ServerRequestEvent,
} from "@qwik.dev/router/middleware/request-handler";
import {
  getNotFound,
  isStaticPath,
  mergeHeadersCookies,
  requestHandler,
} from "@qwik.dev/router/middleware/request-handler";

/** @public */
export interface NetAddr {
  transport: "tcp" | "udp";
  hostname: string;
  port: number;
}

/** @public */
export function createQwikRouter(opts: QwikRouterFetchOptions) {
  if (opts.manifest) {
    setServerPlatform(opts.manifest);
  }
  async function router(request: Request) {
    try {
      const url = new URL(request.url);

      const serverRequestEv: ServerRequestEvent<Response> = {
        mode: "server",
        locale: undefined,
        url,
        env: { get: (p: string) => process.env[p] },
        request,
        getWritableStream: (status, headers, cookies, resolve) => {
          const { readable, writable } = new TransformStream<Uint8Array>();
          const response = new Response(readable, {
            status,
            headers: mergeHeadersCookies(headers, cookies),
          });
          resolve(response);
          return writable;
        },
        platform: {
          ssr: true,
        },
        getClientConn: () => {
          return opts.getClientConn ? opts.getClientConn(request) : {};
        },
      };

      // send request to qwik router request handler
      const handledResponse = await requestHandler(serverRequestEv, opts);
      if (handledResponse) {
        handledResponse.completion.then((v) => {
          if (v) {
            console.error(v);
          }
        });
        const response = await handledResponse.response;
        if (response) {
          return response;
        }
      }

      // qwik router did not have a route for this request
      return null;
    } catch (e: any) {
      console.error(e);
      return new Response(String(e || "Error"), {
        status: 500,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }
  }

  const notFound = async (request: Request) => {
    try {
      const url = new URL(request.url);

      // In the development server, we replace the getNotFound function
      // For static paths, we assign a static "Not Found" message.
      // This ensures consistency between development and production environments for specific URLs.
      const notFoundHtml =
        !request.headers.get("accept")?.includes("text/html") ||
        isStaticPath(request.method || "GET", url)
          ? "Not Found"
          : getNotFound(url.pathname);
      return new Response(notFoundHtml, {
        status: 404,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "X-Not-Found": url.pathname,
        },
      });
    } catch (e) {
      console.error(e);
      return new Response(String(e || "Error"), {
        status: 500,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }
  };

  return {
    router,
    notFound,
  };
}

/**
 * @deprecated Use `createQwikRouter` instead. Will be removed in V3
 * @public
 */
export const createQwikCity = createQwikRouter;

/** @public */
export interface QwikRouterFetchOptions
  extends Omit<ServerRenderOptions, "qwikCityPlan"> {
  getClientConn?: (request: Request) => ClientConn;
}
