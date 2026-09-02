import { WorkerEntrypoint, WorkflowEntrypoint } from "cloudflare:workers";

export class EchoEntrypoint extends WorkerEntrypoint {
  echo(value: string): string {
    return value;
  }
}

export class EchoWorkflow extends WorkflowEntrypoint {
  override async run(): Promise<string> {
    return "echo";
  }
}

export const EXPORTS_VERSION = 1;
