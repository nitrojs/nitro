import type { CounterDO } from "../durable/counter.ts";

export default async (req: Request & { runtime?: any }) => {
  const env = req.runtime?.cloudflare?.env as {
    COUNTER: DurableObjectNamespace<CounterDO>;
  };
  const count = await env.COUNTER.getByName("global").increment();
  return Response.json({
    count,
    hasGlobalEnv: !!(globalThis as any).__env__,
    hasWorkflowBinding: !!(env as any).ECHO_WORKFLOW,
  });
};
