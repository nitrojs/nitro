export interface TaskCLIInfo {
  name: string;
  description?: string;
  implemented: boolean;
}

export type TaskCLICommand =
  | { command: "help" | "list" }
  | { command: "run"; name: string; payload: Record<string, unknown> };

export class TaskCLIUsageError extends Error {}

export const taskCLIUsage = `Usage: node <task-entry> list
       node <task-entry> run <name> [--payload <json>]

Commands:
  list              List compiled task metadata as JSON.
  run <name>        Run one task and print its result as JSON.

Options:
  --payload <json>  A JSON object passed to the task (default: {}).
  -h, --help        Show this help.
`;

export function parseTaskCLI(args: string[], tasks: readonly TaskCLIInfo[]): TaskCLICommand {
  const [command, ...rest] = args;
  if (!command || (isHelp(command) && rest.length === 0)) {
    return { command: "help" };
  }
  if ((command === "list" || command === "run") && rest.some(isHelp)) {
    return { command: "help" };
  }
  if (command === "list") {
    if (rest.length > 0) {
      throw new TaskCLIUsageError("The list command does not accept arguments.");
    }
    return { command };
  }
  if (command !== "run") {
    throw new TaskCLIUsageError(`Unknown command ${JSON.stringify(command)}.`);
  }
  const [name, ...options] = rest;
  if (!name || name.startsWith("-")) {
    throw new TaskCLIUsageError("The run command requires a task name.");
  }
  const task = tasks.find((task) => task.name === name);
  if (!task) {
    throw new TaskCLIUsageError(`Task ${JSON.stringify(name)} is not available.`);
  }
  if (!task.implemented) {
    throw new TaskCLIUsageError(`Task ${JSON.stringify(name)} is not implemented.`);
  }
  if (Object.prototype.hasOwnProperty.call(Object.prototype, name)) {
    throw new TaskCLIUsageError(
      `Task name ${JSON.stringify(name)} is reserved by the task runtime.`
    );
  }
  let payload: Record<string, unknown> = {};
  let hasPayload = false;
  for (let i = 0; i < options.length; i++) {
    const option = options[i];
    if (option !== "--payload" && !option.startsWith("--payload=")) {
      throw new TaskCLIUsageError(`Unknown argument ${JSON.stringify(option)}.`);
    }
    if (hasPayload) {
      throw new TaskCLIUsageError("The --payload option may only be supplied once.");
    }
    hasPayload = true;
    const value = option === "--payload" ? options[++i] : option.slice("--payload=".length);
    if (value === undefined) {
      throw new TaskCLIUsageError("The --payload option requires a JSON object.");
    }
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new TypeError("Expected an object");
      }
      payload = parsed as Record<string, unknown>;
    } catch {
      throw new TaskCLIUsageError("The --payload option must be a valid JSON object.");
    }
  }
  return { command, name, payload };
}

function isHelp(value: string) {
  return value === "--help" || value === "-h";
}
