import { defineHandler } from "nitro";
import type { Workflow } from "@cloudflare/workers-types";

export default defineHandler(async (event) => {
  const workflow = event.req.runtime!.cloudflare!.env.TEST_WORKFLOW as Workflow;
  const instance = await workflow.create({ params: { value: 21 } });
  for (let i = 0; i < 100; i++) {
    const { status, output } = await instance.status();
    if (status === "complete" || status === "errored") {
      return { status, output };
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return new Response("Workflow timed out", { status: 504 });
});
