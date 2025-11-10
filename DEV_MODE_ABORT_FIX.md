# Dev Mode Abort Signal Fix

## Problem

Nitro dev server uses worker threads for hot reload functionality. This creates a problem for handlers that check `event.node.req.signal.aborted` during async work:

1. Dev server receives HTTP request and creates Request A with AbortSignal
2. Request A's signal correctly aborts when client disconnects
3. Dev server calls `worker.fetch(Request A)` to forward to worker thread
4. Worker thread creates NEW Request B from socket with NEW AbortSignal
5. Handler receives Request B's signal which never aborts (no client socket in worker)
6. Handler continues running even after client disconnects

### Impact

Handlers using patterns like:
```typescript
export default defineEventHandler(async (event) => {
  const interval = setInterval(() => {
    if (event.node.req.signal.aborted) {
      clearInterval(interval);
      return;
    }
    // Do work...
  }, 100);
});
```

These handlers never detect client disconnect in dev mode, wasting resources.

## Solution

Two-file IPC-based abort propagation:

### 1. Dev Server Side (`src/dev/server.ts`)

Monitor socket close events and notify worker:

```typescript
// Generate unique request ID
const requestId = Math.random().toString(36).slice(2);

// Monitor socket close
const notifyAbort = () => {
  worker.sendMessage({
    event: "abort-request",
    requestId,
  });
};

nodeReq.once("close", notifyAbort);
nodeRes.once("close", notifyAbort);
if (nodeReq.socket) {
  nodeReq.socket.once("close", notifyAbort);
}

// Add request ID header for worker correlation
const headers = new Headers(event.req.headers);
headers.set("x-nitro-request-id", requestId);
```

### 2. Worker Side (`src/presets/_nitro/runtime/nitro-dev.ts`)

Receive IPC messages and abort corresponding requests:

```typescript
// Track AbortControllers per request
const requestControllers = new Map<string, AbortController>();

// Listen for abort messages from dev server
parentPort?.on("message", (msg) => {
  if (msg?.event === "abort-request") {
    const controller = requestControllers.get(msg.requestId);
    if (controller && !controller.signal.aborted) {
      controller.abort();
    }
  }
});

// Wrap fetch to inject abortable signal
const wrappedFetch = (req: Request) => {
  const requestId = req.headers.get("x-nitro-request-id");
  
  if (requestId) {
    const controller = new AbortController();
    requestControllers.set(requestId, controller);
    
    // Replace Request.signal with our abortable one
    Object.defineProperty(req, "signal", {
      value: controller.signal,
      writable: false,
      configurable: true,
      enumerable: true,
    });
  }
  
  return nitroApp.fetch(req);
};
```

## Production Mode

**No patches needed!** Production mode:
- Uses direct request handling (no worker threads)
- Only one Request object created
- Stock srvx v0.9.5 abort handling works correctly
- Client disconnect properly aborts the signal

## Testing

Run: `pnpm vitest run test/unit/abort-detection.test.ts`

The test verifies:
- ✅ H3 direct: Aborts at iteration 2-3
- ✅ Nitro dev (with fix): Aborts at iteration 2-3  
- ✅ Production: Works without patches

## Files Changed

1. `src/dev/server.ts` - Monitor socket.close, send IPC messages
2. `src/presets/_nitro/runtime/nitro-dev.ts` - Receive IPC, abort controllers
3. `test/unit/abort-detection.test.ts` - Verify fix works
4. `test/fixture/server/routes/abort-test.ts` - Test route with setInterval

Total: **2 runtime patches**, **2 test files**
