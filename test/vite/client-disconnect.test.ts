import http, { type IncomingMessage, type ServerResponse } from "node:http";
import http2, { type Http2ServerRequest, type Http2ServerResponse } from "node:http2";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import type { ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const { createLogger, createServer } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

type NodeReq = IncomingMessage | Http2ServerRequest;
type NodeRes = ServerResponse | Http2ServerResponse;

// #4697, #4772: a client that cancels a pending request (e.g. a page navigating away during a
// POST upload) must not reach Vite's error middleware, which logs `Internal server error: This
// operation was aborted` and sends the error overlay to every open tab. Vite serves HTTP/2 when
// `server.https` is set, where `Http2ServerResponse` has no `destroyed` property.
describe("vite: client disconnect", { concurrent: false }, () => {
  let vite: ViteDevServer;
  const errors: string[] = [];
  let onRequest: ((req: NodeReq, res: NodeRes) => void) | undefined;

  const rootDir = fileURLToPath(new URL("./client-disconnect-fixture", import.meta.url));
  const originalCwd = process.cwd();

  const handle = (req: NodeReq, res: NodeRes) => {
    onRequest?.(req, res);
    vite.middlewares(req as IncomingMessage, res as ServerResponse);
  };

  beforeAll(async () => {
    process.chdir(rootDir);
    const logger = createLogger("warn");
    vite = await createServer({
      root: rootDir,
      server: { middlewareMode: true, ws: false },
      customLogger: { ...logger, error: (msg) => errors.push(msg) },
    });
  }, 30_000);

  // Cancels the next request as soon as the server receives it, like a browser does when the page
  // navigates away, and resolves once its response has closed.
  const cancelOnArrival = (cancel: () => void) => {
    errors.length = 0;
    return new Promise<void>((resolve) => {
      onRequest = (_req, res) => {
        res.once("close", () => resolve());
        cancel();
      };
    });
  };

  afterAll(async () => {
    await vite?.close().catch(() => {});
    process.chdir(originalCwd);
  });

  test("HTTP/1.1", async () => {
    const server = http.createServer(handle);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    try {
      const post = (body: string) =>
        new Promise<string>((resolve, reject) => {
          const req = http.request({ port, method: "POST", path: "/upload" }, (res) => {
            let text = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => (text += chunk));
            res.on("end", () => resolve(text));
          });
          req.on("error", reject);
          req.end(body);
        });
      expect(await post("hello")).toBe("received 5");

      const req = http.request({ port, method: "POST", path: "/upload" });
      req.on("error", () => {});
      const closed = cancelOnArrival(() => req.destroy());
      req.write("partial body");
      await closed;
      await settle();
      expect(errors).toEqual([]);
    } finally {
      onRequest = undefined;
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  }, 30_000);

  test("HTTP/2", async () => {
    const server = http2.createServer(handle);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    const session = http2.connect(`http://localhost:${port}`);
    try {
      const post = (body: string) =>
        new Promise<string>((resolve, reject) => {
          const stream = session.request({ ":method": "POST", ":path": "/upload" });
          let text = "";
          stream.setEncoding("utf8");
          stream.on("data", (chunk) => (text += chunk));
          stream.on("end", () => resolve(text));
          stream.on("error", reject);
          stream.end(body);
        });
      expect(await post("hello")).toBe("received 5");

      const stream = session.request(
        { ":method": "POST", ":path": "/upload" },
        { endStream: false }
      );
      stream.on("error", () => {});
      const closed = cancelOnArrival(() => stream.close(http2.constants.NGHTTP2_CANCEL));
      stream.write("partial body");
      await closed;
      await settle();
      expect(errors).toEqual([]);
    } finally {
      onRequest = undefined;
      session.close();
      await new Promise((resolve) => server.close(resolve));
    }
  }, 30_000);
});

// Gives the dev middleware time to forward a would-be error to Vite.
function settle() {
  return new Promise((resolve) => setTimeout(resolve, 1000));
}
