# Abort Detection Bug

## Summary

Nitro cannot detect client disconnects during async work in handlers. Node.js `close` events only fire **after** the handler Promise resolves, not when the client actually disconnects.

## Test Evidence

Run: `pnpm vitest run test/unit/abort-detection.test.ts`

**H3 Direct Test** ✅ Works correctly:
- Client disconnects after 250ms
- Close event fires at workCounter: **2**
- Handler stops early as expected

**Nitro Dev Test** ❌ Broken:
- Client disconnects after 250ms
- Close events fire at workCounter: **5** (after handler completes)
- Handler runs all 5 iterations despite disconnect

## Root Cause

When Nitro wraps Node.js HTTP handlers, it waits for the handler Promise to resolve before processing the response. This blocks Node.js close event propagation during async work.

## Impact

Handlers using `setInterval`, long loops, or streaming cannot detect disconnects and stop early. They waste server resources by continuing to run after clients disconnect.

## Related

- srvx issue #142: https://github.com/h3js/srvx/issues/142
- Hono's similar fix: https://github.com/honojs/node-server/pull/221
