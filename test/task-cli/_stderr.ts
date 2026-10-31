import { createHash } from "node:crypto";
import type { Result } from "./_run.ts";

export const errorBytes = 16 * 1024 * 1024;

export function errorCase(cleanup: boolean) {
  return {
    task: cleanup ? "echo:payload" : "throw",
    env: {
      TASK_CLI_ERROR_BYTES: String(errorBytes),
      ...(cleanup ? { TASK_CLI_CLOSE_REJECT: "1" } : {}),
    },
    prefix: cleanup
      ? "Task cleanup failed: fixture cleanup rejected:"
      : "Task failed: fixture task threw:",
  };
}

export function stderrSummary(result: Result, prefix: string) {
  return {
    bytes: Buffer.byteLength(result.stderr),
    prefix: result.stderr.startsWith(prefix),
    suffix: result.stderr.endsWith(":end\n"),
    sha256: createHash("sha256").update(result.stderr).digest("hex"),
    closeCount: result.events.filter((event) => event.stage === "plugin:close").length,
    closeComplete: result.events.filter((event) => event.stage === "plugin:close:complete").length,
  };
}

export function expectedErrorDigest(prefix: string) {
  return createHash("sha256")
    .update(prefix)
    .update("E".repeat(errorBytes))
    .update(":end\n")
    .digest("hex");
}
