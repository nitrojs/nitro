import { Agent } from "undici";
import { createServer } from "node:http";
import { toNodeHandler } from "srvx/node";
import { isSocketSupported, getSocketAddress } from "get-port-please";
import { Youch } from "youch";
// --- Server ----

export async function createNodeServer(fetchHandler) {
  const server = createServer(
    toNodeHandler(async (req) => {
      try {
        await fetchHandler(req);
      } catch (error) {
        return renderError(req, error);
      }
    })
  );
  await listen(server);
  const address = server.address();
  return typeof address === "string"
    ? { socketPath: address }
    : { host: "localhost", port: address?.port };
}

async function renderError(req, error) {
  const { Youch } = await import("youch");
  const youch = new Youch();
  return new Response(await youch.toHTML(error), {
    status: error.status || 500,
    headers: {
      "Content-Type": "text/html",
    },
  });
}

async function listen(server) {
  const listenAddr = (await isSocketSupported())
    ? getSocketAddress({
        name: `nitro-vite-worker`,
        pid: true,
        random: true,
      })
    : { port: 0, host: "localhost" };
  return new Promise((resolve, reject) => {
    try {
      server.listen(listenAddr, () => resolve());
    } catch (error) {
      reject(error);
    }
  });
}

// ----- Fetch Remote Address -----

export function fetchAddress(addr, input, inputInit) {
  let url;
  let init;
  if (input instanceof Request) {
    url = new URL(input.url);
    init = {
      method: input.method,
      headers: input.headers,
      body: input.body,
      ...inputInit,
    };
  } else {
    url = new URL(input);
    init = inputInit;
  }
  init = {
    duplex: "half",
    redirect: "manual",
    ...init,
  };
  if (addr.socketPath) {
    return fetch(url, {
      ...init,
      ...fetchSocketOptions(addr.socketPath),
    });
  }
  const origin = `http://${addr.host}${addr.port ? `:${addr.port}` : ""}`;
  const outURL = new URL(url.pathname + url.search, origin);
  return fetch(outURL, init);
}

function fetchSocketOptions(socketPath) {
  if ("Bun" in globalThis) {
    // https://bun.sh/guides/http/fetch-unix
    return { unix: socketPath };
  }
  if ("Deno" in globalThis) {
    // https://github.com/denoland/deno/pull/29154
    return {
      client: Deno.createHttpClient({
        // @ts-expect-error Missing types?
        transport: "unix",
        path: socketPath,
      }),
    };
  }
  // https://github.com/nodejs/undici/issues/2970
  return {
    dispatcher: new Agent({ connect: { socketPath } }),
  };
}
