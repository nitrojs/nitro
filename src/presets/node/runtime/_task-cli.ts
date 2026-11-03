import { parseArgs } from "node:util";
import type { TaskPayload } from "nitro/types";
import { useNitroApp } from "nitro/app";
import { runTask } from "#nitro/runtime/task";
import { callCloseHooks } from "#nitro/runtime/shutdown";
import { tasks } from "#nitro/virtual/tasks";

const usage = `Usage:
  node .output/server/index.mjs task list
  node .output/server/index.mjs task run <name> [--payload <json>]`;

/**
 * Runs `task list` or `task run` against the production build instead of starting the server.
 *
 * Resolves with the exit code once `close` hooks ran and stdout/stderr are flushed.
 *
 * @experimental
 */
export async function runTaskCLI(argv: string[]): Promise<number> {
  const exitCode = await _runTaskCLI(argv).catch((error) => {
    console.error("[nitro]", error);
    return 1;
  });
  return flushOutput(exitCode);
}

async function _runTaskCLI(argv: string[]): Promise<number> {
  if (!import.meta._tasks) {
    console.error("[nitro] Tasks are not enabled (set `experimental.tasks: true`).");
    return 1;
  }

  let args: ReturnType<typeof parseTaskArgs>;
  try {
    args = parseTaskArgs(argv);
  } catch (error) {
    console.error(`[nitro] ${(error as Error).message}\n\n${usage}`);
    return 1;
  }

  const [command, name] = args.positionals;
  if (args.values.help) {
    console.log(usage);
    return 0;
  }
  if (command === "list") {
    return listTasks();
  }
  if (command === "run" && name) {
    return runTaskCommand(name, args.values.payload);
  }
  console.error(usage);
  return 1;
}

function parseTaskArgs(argv: string[]) {
  return parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      payload: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
}

async function listTasks(): Promise<number> {
  for (const [name, task] of Object.entries(tasks)) {
    const description = (await task.resolve?.())?.meta?.description ?? task.meta?.description;
    console.log(` - \`${name}\`${description ? ` - ${description}` : ""}`);
  }
  return 0;
}

async function runTaskCommand(name: string, rawPayload: string | undefined): Promise<number> {
  const payload = parsePayload(rawPayload);
  if (!payload) {
    console.error(`[nitro] Invalid payload: \`${rawPayload}\` (it should be a JSON object)`);
    return 1;
  }
  // Fail fast, before plugins initialize (and connect to databases, ...).
  if (!(name in tasks)) {
    console.error(`[nitro] Task \`${name}\` is not available (see \`task list\`).`);
    return 1;
  }

  // Promises a task hands to `waitUntil` must settle before the process exits.
  const pending: Promise<unknown>[] = [];
  const waitUntil = (promise: Promise<unknown>) => {
    pending.push(Promise.resolve(promise).catch((error) => console.error(error)));
  };

  let output: string | undefined;
  let exitCode = 0;
  try {
    // Async plugins (database connections, ...) must be ready before the task runs.
    await useNitroApp().ready;
    const result = await runTask(name, { payload, context: { waitUntil } });
    await Promise.all(pending);
    output = JSON.stringify(result ?? {});
  } catch (error) {
    console.error(`[nitro] Failed to run task \`${name}\`:`, error);
    exitCode = 1;
  }

  // Release resources (connections, timers, ...) that would keep the process alive.
  await callCloseHooks();

  // Printed last so the result is the final line of stdout.
  if (output !== undefined) {
    console.log(output);
  }
  return exitCode;
}

function parsePayload(raw: string | undefined): TaskPayload | undefined {
  if (raw === undefined) {
    return {};
  }
  try {
    const payload = JSON.parse(raw);
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      return payload;
    }
  } catch {
    // Invalid JSON
  }
}

/** Waits for pending writes to stdout and stderr (asynchronous for pipes) before exiting. */
async function flushOutput(exitCode: number): Promise<number> {
  await Promise.all(
    [process.stdout, process.stderr].map(
      (stream) => new Promise<void>((resolve) => stream.write("", () => resolve()))
    )
  );
  return exitCode;
}
