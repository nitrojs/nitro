import { defineEventHandler } from "nitro/h3";

export default defineEventHandler(async (event) => {
  let closeDuringWork = false;
  let workCounter = 0;
  const events: string[] = [];
  
  events.push("handler-start");
  console.log("[abort-test] Handler started");
  
  // Debug: Check what signal we're getting
  // Access the signal from the Request
  const signal = (event.req as any).signal;
  
  // For debugging: also try to get from runtime.node if available (production)
  const nodeReq = event.runtime?.node?.req;
  const nodeSignal = nodeReq ? (nodeReq as any).signal : undefined;
  
  console.log("[abort-test] Has event.req.signal?", !!signal);
  console.log("[abort-test] Has runtime.node.req.signal?", !!nodeSignal);
  console.log("[abort-test] Are they the same?", signal === nodeSignal);
  
  // Mark this signal so we can track it
  if (!signal._handlerId) {
    signal._handlerId = Math.random().toString(36).slice(2, 6);
  }
  console.log("[abort-test] Handler sees signal ID:", signal._handlerId);
  console.log("[abort-test] signal.aborted at start:", signal?.aborted);
  
  const req = event.node?.req;
  const res = event.node?.res;
  
  console.log("[abort-test] event.node:", !!event.node);
  console.log("[abort-test] event.runtime:", !!event.runtime);
  console.log("[abort-test] event.runtime?.node:", !!event.runtime?.node);
  
  if (!req || !res) {
    console.log("[abort-test] ERROR: Node req/res not available!");
    return { error: "Node req/res not available", events, hasNode: !!event.node, hasRuntime: !!event.runtime };
  }
  
  console.log("[abort-test] Attaching close listener to req");
  req.on("close", () => {
    console.log("[abort-test] REQ CLOSE EVENT FIRED! workCounter:", workCounter);
    events.push(`close-at-counter-${workCounter}`);
    closeDuringWork = workCounter > 0 && workCounter < 5;
  });
  
  console.log("[abort-test] Attaching close listener to res");
  res.on("close", () => {
    console.log("[abort-test] RES CLOSE EVENT FIRED! workCounter:", workCounter);
  });
  
  // Return Promise wrapping setInterval
  return new Promise<any>((resolve) => {
    const interval = setInterval(() => {
      // Check abort signal from srvx fix
      const sig = event.req.signal as any;
      const isAborted = sig?.aborted;
      console.log(`[abort-test] Iteration ${workCounter + 1}: signal._srvxId=${sig?._srvxId}, signal._handlerId=${sig?._handlerId}, aborted=${isAborted}`);
      
      if (isAborted) {
        console.log(`[abort-test] ABORT SIGNAL DETECTED at workCounter: ${workCounter}`);
        clearInterval(interval);
        resolve({ closeDuringWork: true, workCounter, events, abortedEarly: true });
        return;
      }
      
      workCounter++;
      console.log(`[abort-test] Work iteration ${workCounter}`);
      events.push(`work-${workCounter}`);
      
      if (workCounter >= 5) {
        console.log("[abort-test] Completed 5 iterations, resolving");
        clearInterval(interval);
        resolve({ closeDuringWork, workCounter, events });
      }
    }, 100);
    
    res.on("close", () => {
      console.log("[abort-test] RES close in promise - clearing interval");
      clearInterval(interval);
      resolve({ closeDuringWork, workCounter, events, aborted: true });
    });
  });
});
