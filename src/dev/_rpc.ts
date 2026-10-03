// Worker => Host RPC for the dev server (client in `src/runtime/internal/dev-rpc.mjs`).
export async function handleDevRPC(
  message: any,
  opts: {
    sendMessage: (message: unknown) => void;
    handlers: Record<string, (data: any) => unknown>;
  }
): Promise<void> {
  if (typeof message?.__rpc !== "string" || !Object.hasOwn(opts.handlers, message.__rpc)) {
    return;
  }
  try {
    const data = await opts.handlers[message.__rpc]!(message.data);
    opts.sendMessage({ __rpc_id: message.__rpc_id, data });
  } catch (error) {
    opts.sendMessage({
      __rpc_id: message.__rpc_id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
