import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import http from "node:http";
import type {
  Nitro,
  NitroBuildInfo,
  TaskEvent,
  TaskRunnerOptions,
} from "nitropack/types";
import { createFetch, ofetch } from "ofetch";
import { normalize, resolve } from "pathe";

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

  const baseURL = `http://${buildInfo.dev.workerAddress.host || "localhost"}:${
    buildInfo.dev.workerAddress.port || "3000"
  }`;
  const socketPath = buildInfo.dev.workerAddress.socketPath;

  // `fetch` does not support `socketPath`, so when the dev worker listens on
  // a unix socket (or windows named pipe) send requests with `node:http`.
  const devFetch = socketPath
    ? createFetch({
        fetch: _createSocketFetch(socketPath),
        defaults: { baseURL },
      })
    : ofetch.create({ baseURL });

  return {
    buildInfo,
    devFetch,
  };
}

const _nullBodyStatus = new Set([204, 205, 304]);

function _createSocketFetch(socketPath: string): typeof globalThis.fetch {
  return (input, init) =>
    new Promise<Response>((resolve, reject) => {
      const url = input instanceof Request ? input.url : String(input);
      const req = http.request(
        url,
        {
          socketPath,
          method: init?.method || "GET",
          headers: Object.fromEntries(new Headers(init?.headers)),
          signal: init?.signal || undefined,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("error", reject);
          res.on("end", () => {
            try {
              const status = res.statusCode || 500;
              const headers = new Headers();
              for (let i = 0; i < res.rawHeaders.length; i += 2) {
                headers.append(res.rawHeaders[i], res.rawHeaders[i + 1]);
              }
              resolve(
                new Response(
                  _nullBodyStatus.has(status) ? null : Buffer.concat(chunks),
                  { status, statusText: res.statusMessage, headers }
                )
              );
            } catch (error) {
              reject(error);
            }
          });
        }
      );
      req.on("error", reject);
      const body = init?.body;
      if (body == null) {
        req.end();
      } else {
        req.end(body instanceof Uint8Array ? body : String(body));
      }
    });
}

function _pidIsRunning(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
