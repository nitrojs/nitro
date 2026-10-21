import { WorkflowEntrypoint } from "cloudflare:workers";
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";

export class Doubler extends WorkflowEntrypoint<unknown, { value: number }> {
  override async run(event: WorkflowEvent<{ value: number }>, step: WorkflowStep) {
    return step.do("double", async () => event.payload.value * 2);
  }
}
