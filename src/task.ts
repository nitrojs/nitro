import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "pathe";
import { ofetch } from "ofetch";
import type { TaskEvent } from "./runtime";
import { NitroBuildInfo } from "nitropack";

/** @experimental */
export interface TaskRunnerOptions {
  cwd?: string;
  buildDir?: string;
}

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

// --- internal ---

const _devHint = `(is dev server running?)`;

async function _getTasksContext(opts: TaskRunnerOptions) {
  const cwd = resolve(process.cwd(), opts.cwd);
  const outDir = resolve(cwd, opts.buildDir || ".nitro");

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

  const devFetch = ofetch.create({
    baseURL: `http://${buildInfo.dev.workerAddress.host || "localhost"}:${
      buildInfo.dev.workerAddress.port || "3000"
    }`,
    // @ts-expect-error
    socketPath: buildInfo.dev.workerAddress.socketPath,
  });

  return {
    buildInfo,
    devFetch,
  };
}

function _pidIsRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
