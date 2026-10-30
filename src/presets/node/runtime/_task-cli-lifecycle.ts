import type { TaskCLICommand } from "./_task-cli-args.ts";
import { closeTaskApp } from "./_task-cli-close.ts";
import { taskErrorMessage, writeTaskOutput } from "./_task-cli-io.ts";

type TaskRunner = typeof import("./_task-cli-runner.ts");
type RunCommand = Extract<TaskCLICommand, { command: "run" }>;

export async function runTaskCLI(command: RunCommand): Promise<number> {
  let runner: TaskRunner | undefined;
  let interrupted = false;
  let hasError = false;
  let error: unknown;
  let hasCloseError = false;
  let closeError: unknown;
  let signalCode = 0;
  let signalCount = 0;
  // Freeze the first observed failure or signal, including a cleanup-only failure.
  let firstExitCode = 0;
  let notifySignal!: () => void;
  const signaled = new Promise<void>((resolve) => {
    notifySignal = resolve;
  });
  let stop!: () => void;
  const stopped = new Promise<void>((resolve) => {
    stop = () => {
      interrupted = true;
      resolve();
    };
  });
  const fail = (reason: unknown) => {
    // Cleanup may reject in-flight initialization or work after a signal already won.
    if (!hasError && signalCode === 0) {
      hasError = true;
      error = reason;
      firstExitCode ||= 1;
    }
    stop();
  };
  const onSignal = (signal: "SIGINT" | "SIGTERM") => {
    signalCode ||= signal === "SIGINT" ? 130 : 143;
    firstExitCode ||= signalCode;
    if (++signalCount > 1) {
      // A second signal can terminate a user close hook that never settles.
      process.exit(firstExitCode); // eslint-disable-line unicorn/no-process-exit
    }
    notifySignal();
    stop();
  };
  const onSIGINT = () => onSignal("SIGINT");
  const onSIGTERM = () => onSignal("SIGTERM");
  process.on("SIGINT", onSIGINT);
  process.on("SIGTERM", onSIGTERM);
  process.on("unhandledRejection", fail);
  process.on("uncaughtException", fail);
  // A pending promise alone does not keep Node alive long enough to finish or cancel a task.
  const keepAlive = setInterval(() => {}, 2_147_483_647);

  try {
    let result: unknown;
    const operation = (async () => {
      runner = await import("./_task-cli-runner.ts");
      if (interrupted) {
        return;
      }
      await runner.initializeTaskApp();
      if (interrupted) {
        return;
      }
      result = await runner.executeTask(command.name, command.payload);
    })().catch(fail);

    await Promise.race([operation, stopped]);
    if (!interrupted) {
      // Cancellation may truncate output, but must still reach cleanup under backpressure.
      await Promise.race([
        writeTaskOutput(process.stdout, `${JSON.stringify(result ?? null) ?? "null"}\n`),
        stopped,
      ]);
    }
  } catch (reason) {
    fail(reason);
  } finally {
    try {
      await closeTaskApp();
    } catch (reason) {
      hasCloseError = true;
      closeError = reason;
      firstExitCode ||= 1;
    }
    try {
      // Attempt the first diagnostic even after a signal, but allow cancellation to
      // truncate it. A task failure alone must not cancel its own error output.
      if (hasError) {
        await Promise.race([
          writeTaskOutput(process.stderr, `Task failed: ${taskErrorMessage(error)}\n`),
          signaled,
        ]);
      }
      // Once interrupted, do not queue a second diagnostic behind a blocked write.
      if (hasCloseError && (!hasError || signalCode === 0)) {
        await Promise.race([
          writeTaskOutput(process.stderr, `Task cleanup failed: ${taskErrorMessage(closeError)}\n`),
          signaled,
        ]);
      }
    } catch (reason) {
      fail(reason);
    }
    clearInterval(keepAlive);
    process.off("SIGINT", onSIGINT);
    process.off("SIGTERM", onSIGTERM);
    process.off("unhandledRejection", fail);
    process.off("uncaughtException", fail);
  }

  return firstExitCode;
}
