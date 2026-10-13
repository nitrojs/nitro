import type { RunnerManager } from "env-runner";

const SHUTDOWN_TIMEOUT = 5000;

/**
 * Ask the dev runner to shut down gracefully and wait for it to acknowledge.
 *
 * Closing a runner terminates its runtime outright, so the runtime `close` hooks only run when
 * the worker is given a chance to run them first (`ipc.onClose` in the dev entries).
 */
export async function shutdownRunner(
  manager: RunnerManager,
  opts: { warn?: (message: string) => void } = {}
): Promise<void> {
  await new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer);
      manager.offMessage(listener);
      resolve();
    };
    const timer = setTimeout(() => {
      opts.warn?.("Dev worker did not shut down in time, force closing it...");
      done();
    }, SHUTDOWN_TIMEOUT);
    const listener = (message: any) => {
      if (message?.event === "exit") {
        done();
      }
    };
    manager.onMessage(listener);
    try {
      manager.sendMessage({ event: "shutdown" });
    } catch (error) {
      opts.warn?.(
        `Could not send shutdown message to the dev worker: ${error instanceof Error ? error.message : String(error)}`
      );
      done();
    }
  });
}
