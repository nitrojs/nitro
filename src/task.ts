import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type {
  Nitro,
  NitroBuildInfo,
  TaskEvent,
  TaskRunnerOptions,
} from "nitro/types";
import { normalize, resolve } from "pathe";
import http from "node:http";
import type { RequestOptions } from "node:http";
import { withBase, withQuery } from "ufo";
import type { QueryObject } from "ufo";

/** @experimental */
export async function runTask(
  taskEvent: TaskEvent,
  opts?: TaskRunnerOptions
): Promise<{ result: unknown }> {
  const ctx = await _getTasksContext(opts);
  const result = await ctx.devFetch(`/_nitro/tasks/${taskEvent.name}`, {
    method: "POST",
    body: taskEvent,
  });
  return result;
}

/** @experimental */
export async function listTasks(opts?: TaskRunnerOptions) {
  const ctx = await _getTasksContext(opts);
  const res = (await ctx.devFetch("/_nitro/tasks")) as {
    tasks: Record<string, { meta: { description: string } }>;
  };
  return res.tasks;
}

// --- nitro internal ---
export function addNitroTasksVirtualFile(nitro: Nitro) {
  nitro.options.virtual["#nitro-internal-virtual/tasks"] = () => {
    const _scheduledTasks = Object.entries(nitro.options.scheduledTasks || {})
      .map(([cron, _tasks]) => {
        const tasks = (Array.isArray(_tasks) ? _tasks : [_tasks]).filter(
          (name) => {
            if (!nitro.options.tasks[name]) {
              nitro.logger.warn(`Scheduled task \`${name}\` is not defined!`);
              return false;
            }
            return true;
          }
        );
        return { cron, tasks };
      })
      .filter((e) => e.tasks.length > 0);
    const scheduledTasks: false | { cron: string; tasks: string[] }[] =
      _scheduledTasks.length > 0 ? _scheduledTasks : false;

    return /* js */ `
export const scheduledTasks = ${JSON.stringify(scheduledTasks)};

export const tasks = {
  ${Object.entries(nitro.options.tasks)
    .map(
      ([name, task]) =>
        `"${name}": {
          meta: {
            description: ${JSON.stringify(task.description)},
          },
          resolve: ${
            task.handler
              ? `() => import("${normalize(
                  task.handler
                )}").then(r => r.default || r)`
              : "undefined"
          },
        }`
    )
    .join(",\n")}
};`;
  };
}

// --- module internal ---

const _devHint = `(is dev server running?)`;

async function _getTasksContext(opts?: TaskRunnerOptions) {
  const cwd = resolve(process.cwd(), opts?.cwd || ".");
  const outDir = resolve(cwd, opts?.buildDir || ".nitro");

  const buildInfoPath = resolve(outDir, "nitro.json");
  if (!existsSync(buildInfoPath)) {
    throw new Error(`Missing info file: \`${buildInfoPath}\` ${_devHint}`);
  }

  const buildInfo = JSON.parse(
    await readFile(buildInfoPath, "utf8")
  ) as NitroBuildInfo;

  if (!buildInfo.dev?.pid || !buildInfo.dev?.workerAddress) {
    throw new Error(
      `Missing dev server info in: \`${buildInfoPath}\` ${_devHint}`
    );
  }

  if (!_pidIsRunning(buildInfo.dev.pid)) {
    throw new Error(`Dev server is not running (pid: ${buildInfo.dev.pid})`);
  }

  const baseURL = `http://${buildInfo.dev.workerAddress.host || "localhost"}:${buildInfo.dev.workerAddress.port || "3000"}`;
  const socketPath = buildInfo.dev.workerAddress.socketPath;

  // `ofetch` doesn't support `socketPath`, so we use `http.request` directly
  const devFetch = <T = any>(
    path: string,
    options?: {
      method?: RequestOptions["method"];
      query?: QueryObject;
      body?: unknown;
    }
  ) => {
    return new Promise<T>((resolve, reject) => {
      let url = withBase(path, baseURL);
      if (options?.query) {
        url = withQuery(url, options.query);
      }

      const request = http.request(
        url,
        {
          socketPath,
          method: options?.method,
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        },
        (response) => {
          if (
            !response.statusCode ||
            (response.statusCode >= 400 && response.statusCode < 600)
          ) {
            reject(new Error(response.statusMessage));
            return;
          }

          let data = "";
          response
            .on("data", (chunk) => (data += chunk))
            // Response of tasks is always JSON
            .on("end", () => resolve(JSON.parse(data)))
            .on("error", (e) => reject(e));
        }
      );

      request.on("error", (e) => reject(e));

      if (options?.body) {
        request.write(JSON.stringify(options.body));
      }
      request.end();
    });
  };

  return {
    buildInfo,
    devFetch,
  };
}

function _pidIsRunning(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
