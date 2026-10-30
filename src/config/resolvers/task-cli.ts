import type { NitroOptions } from "nitro/types";

export function resolveTaskCLIOptions(options: NitroOptions) {
  if (!options.experimental.taskCLI || options.dev) {
    return;
  }
  if (!options.experimental.tasks) {
    throw new Error("`experimental.taskCLI` requires `experimental.tasks: true`.");
  }
  if (
    options.static ||
    !options.node ||
    !["node", "node-server", "node-middleware", "node-cluster"].includes(options.preset) ||
    !["rollup", "rolldown", "vite"].includes(String(options.builder))
  ) {
    throw new Error(
      "`experimental.taskCLI` requires a bundled production Node server, middleware or cluster preset."
    );
  }
}
