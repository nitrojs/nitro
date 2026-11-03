import type { ChildProcess } from "node:child_process";

/**
 * Wait until a spawned server answers HTTP requests at `url`.
 *
 * Polls with `fetch` instead of binding the port (like `get-port-please`'s `waitForPort`),
 * which can race with the server's own `listen()` and make it fail with `EADDRINUSE`.
 * Fails fast when the child process exits before the server is ready.
 */
export async function waitForServer(
  url: string,
  child: ChildProcess,
  opts: { timeout?: number } = {}
): Promise<void> {
  const deadline = Date.now() + (opts.timeout ?? 20_000);
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(
        `Server process exited before it was ready (code: ${child.exitCode}, signal: ${child.signalCode})`
      );
    }
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1000) });
      await res.body?.cancel();
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error(`Timed out waiting for the server at ${url}`);
}
