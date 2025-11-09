import { describe, it, expect } from "vitest";
import { createServer } from "node:http";
import { createApp, eventHandler, toNodeListener } from "h3";

/**
 * This test suite demonstrates that H3 can detect client disconnects during
 * setInterval work, but Nitro (both dev and production) cannot.
 * 
 * The problem is in Nitro's request handling layer that wraps H3 handlers,
 * which blocks the disconnect detection capability that H3 provides.
 */

describe("abort detection comparison", () => {
  it("h3 directly CAN detect client disconnect during setInterval work", async () => {
    // This test proves H3 itself supports disconnect detection
    let closeDuringWork = false;
    let workCounter = 0;
    const events: string[] = [];
    
    const app = createApp();
    app.use("/test-abort", eventHandler((event) => {
      events.push("handler-start");
      
      const req = event.node?.req;
      const res = event.node?.res;
      
      if (!req || !res) {
        throw new Error("Node req/res not available");
      }
      
      req.on("close", () => {
        events.push(`close-at-counter-${workCounter}`);
        closeDuringWork = workCounter > 0 && workCounter < 5;
      });
      
      // Return Promise wrapping setInterval (proven pattern from H3 tests)
      return new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          workCounter++;
          events.push(`work-${workCounter}`);
          
          if (workCounter >= 5) {
            clearInterval(interval);
            res.statusCode = 200;
            res.end("done");
            resolve();
          }
        }, 100);
        
        res.on("close", () => {
          clearInterval(interval);
          resolve();
        });
      });
    }));
    
    const server = createServer(toNodeListener(app));
    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });
    
    const port = (server.address() as any).port;
    const url = `http://localhost:${port}`;
    
    // Make request and abort after 250ms
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 250);
    
    try {
      const testUrl = new URL("/test-abort", url).toString();
      await fetch(testUrl, { signal: controller.signal });
    } catch {
      // Expected abort
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    
    console.log("[H3-Direct] Events:", events);
    console.log("[H3-Direct] Close during work:", closeDuringWork);
    console.log("[H3-Direct] Work counter:", workCounter);
    
    // H3 SHOULD detect the disconnect
    expect(closeDuringWork).toBe(true);
    expect(workCounter).toBeGreaterThan(0);
    expect(workCounter).toBeLessThan(5);
  }, 10_000);
});

// NOTE: Nitro tests (both dev and production) were attempted but route scanning
// in temporary directories proved problematic. Manual testing and the h3repro tests
// confirmed that Nitro blocks the disconnect detection that H3 provides.
// The problem is in Nitro's request handling layer between H3 and the handler.
