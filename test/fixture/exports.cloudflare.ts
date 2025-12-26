export function myScheduled() {
  console.log("scheduled!");
}

// Example Workflow - demonstrates Workflows support
// Workflows are durable, fault-tolerant execution environments
// @see https://developers.cloudflare.com/workflows/
export class ExampleWorkflow {
  async run(event: any, step: any) {
    const result = await step.do("process-data", async () => {
      return { processed: true, timestamp: Date.now() };
    });

    await step.do("log-result", async () => {
      console.log("Workflow result:", result);
    });

    return result;
  }
}
