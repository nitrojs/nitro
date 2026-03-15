import type * as CF from "@cloudflare/workers-types";
import type { CloudflareDurableResolver, CloudflareDurableResolverContext } from "../types.ts";

type MaybePromise<T> = T | Promise<T>;

export interface ResolveDurableStubOptions {
  bindingName: string;
  instanceName: string;
  request?: Request;
  env: Record<string, unknown>;
  context?: CF.ExecutionContext;
  resolveInstanceName?: CloudflareDurableResolver;
}

export async function getDurableStub({
  bindingName,
  instanceName,
  request,
  env,
  context,
  resolveInstanceName,
}: ResolveDurableStubOptions) {
  const binding = env[bindingName] as CF.DurableObjectNamespace | undefined;
  if (!binding) {
    throw new Error(`Durable Object binding "${bindingName}" not available.`);
  }

  const durableInstanceName = await resolveDurableInstanceName({
    request,
    env,
    context,
    defaultInstanceName: instanceName,
    resolveInstanceName,
  });

  return binding.get(binding.idFromName(durableInstanceName));
}

export async function resolveDurableInstanceName({
  request,
  env,
  context,
  defaultInstanceName,
  resolveInstanceName,
}: CloudflareDurableResolverContext & {
  resolveInstanceName?: CloudflareDurableResolver;
}) {
  const durableInstanceName = await resolveMaybe(
    resolveInstanceName?.({
      request,
      env,
      context,
      defaultInstanceName,
    })
  );

  return durableInstanceName || defaultInstanceName || "server";
}

async function resolveMaybe<T>(value: MaybePromise<T> | undefined) {
  return value ? await value : value;
}
