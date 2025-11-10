import { defineEventHandler } from "nitro/h3";

export default defineEventHandler(async (event) => {
  let closeDuringWork = false;
  let workCounter = 0;
  const events: string[] = [];
  
  events.push("handler-start");
  console.log("[abort-test] Handler started");
  
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
