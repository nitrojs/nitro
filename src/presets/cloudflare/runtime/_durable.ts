import type * as CF from "@cloudflare/workers-types";
import type { CloudflareDurableResolver } from "../types.ts";

export function createDurableStubResolver(options: {
  bindingName: string;
  instanceName: string;
  resolveInstanceName?: CloudflareDurableResolver;
}) {
  return async (
    request: Request | undefined,
    env: Record<string, unknown>,
    context?: CF.ExecutionContext
  ) => {
    const binding = env[options.bindingName] as CF.DurableObjectNamespace | undefined;
    if (!binding) {
      throw new Error(`Durable Object binding "${options.bindingName}" not available.`);
    }
    const name = await options.resolveInstanceName?.({
      request,
      env,
      context,
      defaultInstanceName: options.instanceName,
    });
    return binding.get(binding.idFromName(name || options.instanceName || "server"));
  };
}
