// Shim for "cloudflare:workers" import in dev environment

// unenv shim respects __env__
export { env } from "unenv/node/internal/process/env";

export async function waitUntil(promise) {
  await globalThis.__wait_until__?.(promise);
}

export function withEnv(newEnv, fn) {
  throw new Error("cf.withEnv is not implemented in dev env currently.");
}

class NotImplemented {
  constructor() {
    throw new Error("Not implemented in dev env currently.");
  }
}

export class DurableObject extends NotImplemented {}
export class RpcPromise extends NotImplemented {}
export class RpcProperty extends NotImplemented {}
export class RpcStub extends NotImplemented {}
export class RpcTarget extends NotImplemented {}
export class ServiceStub extends NotImplemented {}
export class WorkerEntrypoint extends NotImplemented {}
export class WorkflowEntrypoint extends NotImplemented {}
