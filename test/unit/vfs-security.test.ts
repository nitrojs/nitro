import { describe, expect, it } from "vitest";
import { mockEvent } from "h3";
import { createVFSHandler } from "../../src/dev/vfs.ts";
import type { Nitro } from "nitro/types";

// Mock a socket that appears to be a Unix socket
function createUnixSocketMock() {
  return {
    remoteAddress: undefined,
    localAddress: undefined,
    remotePort: undefined,
    readable: true,
    writable: true,
    address: () => ({}),
  } as any;
}

// Mock a regular network socket
function createNetworkSocketMock(ip: string) {
  return {
    remoteAddress: ip,
    localAddress: "127.0.0.1",
    remotePort: 12345,
    readable: true,
    writable: true,
    address: () => ({ address: ip, port: 12345 }),
  } as any;
}

// Create a mock event with socket
function createMockEvent(
  socket: any,
  headers: Record<string, string> = {},
  params: Record<string, string> = {}
) {
  const event = mockEvent("http://localhost/_vfs", {
    headers,
  });
  // Attach the socket to the runtime.node.req (runtime is readonly, use defineProperty)
  Object.defineProperty(event, "runtime", {
    value: {
      node: {
        req: { socket },
      },
    },
    writable: false,
    configurable: true,
  });
  event.context.params = params;
  return event;
}

describe("VFS Security - X-Forwarded-For spoofing on Unix socket", () => {
  it("should reject requests with spoofed X-Forwarded-For header on Unix socket", async () => {
    // Create a mock Nitro instance with some VFS content
    const mockNitro = {
      options: {
        rootDir: "/test/root",
      },
      vfs: new Map([["/test/root/test.js", { render: () => "test content" }]]),
    } as unknown as Nitro;

    const handler = createVFSHandler(mockNitro);

    // Create a mock Unix socket event with spoofed X-Forwarded-For
    const unixSocket = createUnixSocketMock();
    const event = createMockEvent(unixSocket, {
      "x-forwarded-for": "127.0.0.1",
    });

    // This should throw 403 because Unix socket access is denied
    await expect(handler(event)).rejects.toThrow("VFS access not available on Unix socket");
  });

  it("should reject requests without X-Forwarded-For on Unix socket", async () => {
    const mockNitro = {
      options: {
        rootDir: "/test/root",
      },
      vfs: new Map([["/test/root/test.js", { render: () => "test content" }]]),
    } as unknown as Nitro;

    const handler = createVFSHandler(mockNitro);

    // Create a mock Unix socket event without X-Forwarded-For
    const unixSocket = createUnixSocketMock();
    const event = createMockEvent(unixSocket, {});

    // Should reject because Unix socket access is denied
    await expect(handler(event)).rejects.toThrow("VFS access not available on Unix socket");
  });

  it("should reject requests from non-local IP on regular network socket", async () => {
    const mockNitro = {
      options: {
        rootDir: "/test/root",
      },
      vfs: new Map([["/test/root/test.js", { render: () => "test content" }]]),
    } as unknown as Nitro;

    const handler = createVFSHandler(mockNitro);

    // Create a mock network socket from external IP
    const networkSocket = createNetworkSocketMock("192.168.1.100");
    const event = createMockEvent(networkSocket, {});

    // Should reject because IP is not local
    await expect(handler(event)).rejects.toThrow("Forbidden IP");
  });

  it("should NOT trust X-Forwarded-For header on regular network socket", async () => {
    const mockNitro = {
      options: {
        rootDir: "/test/root",
      },
      vfs: new Map([["/test/root/test.js", { render: () => "test content" }]]),
    } as unknown as Nitro;

    const handler = createVFSHandler(mockNitro);

    // Create a mock network socket from external IP with spoofed X-Forwarded-For
    const networkSocket = createNetworkSocketMock("192.168.1.100");
    const event = createMockEvent(networkSocket, {
      "x-forwarded-for": "127.0.0.1",
    });

    // Should reject because X-Forwarded-For is not trusted on network sockets
    await expect(handler(event)).rejects.toThrow("Forbidden IP");
  });
});
