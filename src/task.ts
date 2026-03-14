import http from "node:http";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "pathe";
import { withBase, withQuery } from "ufo";

import type { QueryObject } from "ufo";
import type { RequestOptions } from "node:http";
import type { NitroBuildInfo, TaskEvent, TaskRunnerOptions } from "nitro/types";

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

// --- module internal ---

const _devHint = `(is dev server running?)`;

async function _getTasksContext(opts?: TaskRunnerOptions) {
  const cwd = resolve(process.cwd(), opts?.cwd || ".");
  const buildDir = resolve(cwd, opts?.buildDir || "node_modules/.nitro");

  const buildInfoPath = resolve(buildDir, "nitro.dev.json");
  if (!existsSync(buildInfoPath)) {
    throw new Error(`Missing info file: \`${buildInfoPath}\` ${_devHint}`);
  }

  const buildInfo = JSON.parse(await readFile(buildInfoPath, "utf8")) as NitroBuildInfo;

  if (!buildInfo.dev?.pid || !buildInfo.dev?.workerAddress) {
    throw new Error(`Missing dev server info in: \`${buildInfoPath}\` ${_devHint}`);
  }

  if (!_pidIsRunning(buildInfo.dev.pid)) {
    throw new Error(`Dev server is not running (pid: ${buildInfo.dev.pid})`);
  }

  const baseURL = `http://${buildInfo.dev.workerAddress.host || "localhost"}:${buildInfo.dev.workerAddress.port || "3000"}`;
  const socketPath = buildInfo.dev.workerAddress.socketPath;

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
          if (!response.statusCode || (response.statusCode >= 400 && response.statusCode < 600)) {
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
