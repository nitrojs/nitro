import { taskMeta } from "#nitro/virtual/task-meta";
import { parseTaskCLI, taskCLIUsage, TaskCLIUsageError } from "./_task-cli-args.ts";
import { taskErrorMessage, writeTaskOutput } from "./_task-cli-io.ts";

let exitCode = 0;
try {
  const command = parseTaskCLI(process.argv.slice(2), taskMeta);
  switch (command.command) {
    case "help": {
      await writeTaskOutput(process.stdout, taskCLIUsage);
      break;
    }
    case "list": {
      await writeTaskOutput(process.stdout, `${JSON.stringify(taskMeta)}\n`);
      break;
    }
    case "run": {
      const { runTaskCLI } = await import("./_task-cli-lifecycle.ts");
      exitCode = await runTaskCLI(command);
      break;
    }
  }
} catch (error) {
  exitCode = error instanceof TaskCLIUsageError ? 2 : 1;
  try {
    await writeTaskOutput(process.stderr, `${taskErrorMessage(error)}\n`);
    if (exitCode === 2) {
      await writeTaskOutput(process.stderr, taskCLIUsage);
    }
  } catch {
    // The output stream may already be closed.
  }
}

process.exit(exitCode); // eslint-disable-line unicorn/no-process-exit
