import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { fetchAddress } from "../../src/runner/proxy.ts";
import type { AddressInfo } from "node:net";

// --- TCP server ---

let tcpServer: Server;
let tcpPort: number;

beforeAll(async () => {
  tcpServer = createServer((req, res) => {
    if (req.url === "/json") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    if (req.url === "/echo" && req.method === "POST") {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        res.writeHead(200, { "content-type": "text/plain" });
        res.end(Buffer.concat(chunks));
      });
      return;
    }
    if (req.url?.startsWith("/headers")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ headers: req.headers, url: req.url }));
      return;
    }
    if (req.url === "/redirect") {
      res.writeHead(302, { location: "/json" });
      res.end();
      return;
    }
    if (req.url === "/multi-cookie") {
      res.writeHead(200, [
        ["set-cookie", "a=1; Path=/"],
        ["set-cookie", "b=2; Path=/"],
        ["set-cookie", "c=3; Path=/"],
        ["content-type", "text/plain"],
      ]);
      res.end("ok");
      return;
    }
    if (req.url === "/no-content") {
      res.writeHead(204);
      res.end();
      return;
    }
    res.writeHead(404);
    res.end("Not found");
  });

  await new Promise<void>((resolve) => {
    tcpServer.listen(0, "127.0.0.1", resolve);
  });
  tcpPort = (tcpServer.address() as AddressInfo).port;
});

afterAll(() => {
  tcpServer?.close();
});

// --- Unix socket server ---

let socketServer: Server;
const socketPath = join(tmpdir(), `nitro-test-${process.pid}-${Date.now()}.sock`);

beforeAll(async () => {
  socketServer = createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("unix-ok");
  });
  await new Promise<void>((resolve) => {
    socketServer.listen(socketPath, resolve);
  });
});

afterAll(() => {
  socketServer?.close();
});

// --- Tests ---

describe("fetchAddress", () => {
  describe("TCP (host + port)", () => {
    it("GET request returns JSON", async () => {
      const res = await fetchAddress({ host: "127.0.0.1", port: tcpPort }, `http://localhost/json`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("application/json");
      expect(await res.json()).toEqual({ ok: true });
    });

    it("POST with body", async () => {
      const res = await fetchAddress(
        { host: "127.0.0.1", port: tcpPort },
        `http://localhost/echo`,
        { method: "POST", body: "hello" }
      );
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("hello");
    });

    it("forwards custom headers", async () => {
      const res = await fetchAddress(
        { host: "127.0.0.1", port: tcpPort },
        `http://localhost/headers`,
        { headers: { "x-custom": "test-value" } }
      );
      const body = await res.json();
      expect(body.headers["x-custom"]).toBe("test-value");
    });

    it("handles redirect manually (no follow)", async () => {
      const res = await fetchAddress(
        { host: "127.0.0.1", port: tcpPort },
        `http://localhost/redirect`
      );
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("/json");
    });

    it("handles 204 no content", async () => {
      const res = await fetchAddress(
        { host: "127.0.0.1", port: tcpPort },
        `http://localhost/no-content`
      );
      expect(res.status).toBe(204);
      expect(res.body).toBeNull();
    });

    it("preserves multiple set-cookie headers", async () => {
      const res = await fetchAddress(
        { host: "127.0.0.1", port: tcpPort },
        `http://localhost/multi-cookie`
      );
      expect(res.status).toBe(200);
      const cookies = res.headers.getSetCookie();
      expect(cookies).toEqual(["a=1; Path=/", "b=2; Path=/", "c=3; Path=/"]);
    });

    it("strips transfer-encoding and keep-alive headers", async () => {
      const res = await fetchAddress({ host: "127.0.0.1", port: tcpPort }, `http://localhost/json`);
      expect(res.headers.has("transfer-encoding")).toBe(false);
      expect(res.headers.has("keep-alive")).toBe(false);
    });

    it("handles Request object input", async () => {
      const req = new Request("http://localhost/json", {
        headers: { accept: "application/json" },
      });
      const res = await fetchAddress({ host: "127.0.0.1", port: tcpPort }, req);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
    });

    it("preserves query string", async () => {
      const res = await fetchAddress(
        { host: "127.0.0.1", port: tcpPort },
        `http://localhost/headers?foo=bar`
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { url: string };
      expect(body.url).toBe("/headers?foo=bar");
    });
  });

  describe("Unix socket", () => {
    it("GET via unix socket", async () => {
      const res = await fetchAddress({ socketPath }, `http://localhost/anything`);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("unix-ok");
    });
  });

  describe("POST with streaming body", () => {
    it("pipes ReadableStream body", async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("streamed"));
          controller.close();
        },
      });
      const res = await fetchAddress(
        { host: "127.0.0.1", port: tcpPort },
        `http://localhost/echo`,
        { method: "POST", body: stream }
      );
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("streamed");
    });
  });

  describe("error handling", () => {
    it("rejects on connection error", async () => {
      await expect(
        fetchAddress({ host: "127.0.0.1", port: 1 }, `http://localhost/`)
      ).rejects.toThrow();
    });
  });
});
