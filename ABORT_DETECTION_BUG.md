# Abort Detection Bug in Nitro

## Summary

Nitro cannot detect client disconnects during async operations (like `setInterval`) in event handlers. The Node.js `close` events on `req` and `res` only fire **after** the handler Promise resolves, not when the client actually disconnects.

## Evidence

### Test Results

**H3 Direct** (works correctly):
```
[H3-Direct] Events: [ 'handler-start', 'work-1', 'work-2', 'close-at-counter-2' ]
[H3-Direct] Close during work: true ✅
[H3-Direct] Work counter: 2 ✅
```

**Nitro Dev** (broken):
```
[abort-test] Work iteration 1
[abort-test] Work iteration 2
[Nitro-Dev] Request aborted (client disconnected)
[abort-test] Work iteration 3  ❌ Should have stopped!
[abort-test] Work iteration 4  ❌
[abort-test] Work iteration 5  ❌
[abort-test] Completed 5 iterations
[abort-test] RES CLOSE EVENT FIRED! workCounter: 5  ❌ Too late!
[abort-test] REQ CLOSE EVENT FIRED! workCounter: 5  ❌ Too late!
```

## Root Cause

The issue is in how `srvx`'s `toNodeHandler` (and possibly H3's `h3App.fetch()`) handles response streaming:

1. Node.js HTTP server receives request → creates IncomingMessage & ServerResponse
2. srvx's `toNodeHandler` wraps these in a ServerRequest with `runtime.node`
3. Nitro calls `h3App.fetch(req)` → returns Promise<Response>
4. **The Promise resolution is awaited before writing to Node.js response stream**
5. Node.js close events only fire after the response stream completes
6. This blocks disconnect detection during async work

## Impact

Handlers that:
- Use `setInterval` or long-running loops
- Stream data over time
- Perform long computations

Cannot detect client disconnects and stop early. They continue running even after the client has disconnected, wasting server resources.

## Workaround

None currently. The handler's Promise must resolve before close events fire.

## Potential Fix Locations

1. **srvx/node's `toNodeHandler`**: Modify to allow close events to propagate immediately
2. **H3's response streaming**: Ensure response body streaming doesn't block event propagation
3. **Nitro's appHandler**: Add explicit close event forwarding mechanism

## Test File

See `test/unit/abort-detection.test.ts` and `test/fixture/server/routes/abort-test.ts`
