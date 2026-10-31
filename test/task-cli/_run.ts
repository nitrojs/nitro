import { spawn, type ChildProcess } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "pathe";
import { probePath, type BuiltFixture } from "./_build.ts";
import { observeEvents, type Event } from "./_events.ts";
import { observeStreams } from "./_streams.ts";
import { observeExit } from "./_exit.ts";
export interface Result {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  events: Event[];
}
let sequence = 0;
const running = new Map<ChildProcess, () => void>();
const finishes = new Set<Promise<Result>>();

export async function startCLI(
  fixture: BuiltFixture,
  args: string[],
  options: {
    env?: Record<string, string>;
    probes?: boolean;
    ipc?: boolean;
    pauseStdout?: boolean;
    pauseStderr?: boolean;
    epipeProbe?: boolean;
  } = {}
) {
  return start(fixture, [fixture.entry, ...args], { ...options, ipc: options.ipc !== false });
}

export async function startMain(fixture: BuiltFixture, options: { probes?: boolean } = {}) {
  const entry =
    fixture.info.preset === "node-cluster"
      ? join(fixture.outDir, "server/index.mjs")
      : join(fixture.outDir, fixture.info.serverEntry!);
  const args =
    fixture.info.preset === "node-middleware"
      ? [fileURLToPath(new URL("middleware-host.mjs", import.meta.url)), entry]
      : [entry];
  return start(fixture, args, { ...options, ipc: false });
}

async function start(
  fixture: BuiltFixture,
  args: string[],
  options: {
    env?: Record<string, string>;
    probes?: boolean;
    ipc: boolean;
    pauseStdout?: boolean;
    pauseStderr?: boolean;
    epipeProbe?: boolean;
  }
) {
  const eventsFile = join(fixture.baseDir, `events-${++sequence}.jsonl`);
  await writeFile(eventsFile, "");
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NITRO_HOST: "127.0.0.1",
    NITRO_PORT: "0",
    PORT: "0",
    NITRO_CLUSTER_WORKERS: "2",
    NITRO_SAMPLE_LABEL: "runtime 配置",
    TASK_CLI_EVENTS: eventsFile,
    ...options.env,
  };
  delete env.CI;
  delete env.TEST;
  const nodeArgs = options.probes ? ["--import", pathToFileURL(probePath).href] : [];
  if (options.epipeProbe) {
    nodeArgs.push("--import", new URL("_boundary-probe.mjs", import.meta.url).href);
  }
  const child = spawn(process.execPath, [...nodeArgs, ...args], {
    cwd: fixture.cwd,
    env,
    stdio: options.ipc ? ["ignore", "pipe", "pipe", "ipc"] : ["ignore", "pipe", "pipe"],
  });
  const exit = observeExit(child);
  const watchers = new Set<() => void>();
  const streams = observeStreams({ stdout: child.stdout!, stderr: child.stderr! }, options, () => {
    for (const fn of watchers) fn();
  });
  running.set(child, streams.resume);
  const log = observeEvents(
    eventsFile,
    () => {
      for (const fn of watchers) fn();
    },
    () => child.kill("SIGKILL")
  );
  const deadline = setTimeout(() => child.kill("SIGKILL"), 15_000);
  void exit.exited.then(() => clearTimeout(deadline));
  const finished = new Promise<Result>((resolve, reject) => {
    child.once("error", (error) => {
      clearTimeout(deadline);
      log.close();
      running.delete(child);
      reject(error);
    });
    child.once("close", async (code, signal) => {
      clearTimeout(deadline);
      running.delete(child);
      try {
        const events = await log.finish();
        resolve({ code, signal, stdout: streams.stdout, stderr: streams.stderr, events });
      } catch (error) {
        reject(error);
      } finally {
        for (const fn of watchers) fn();
      }
    });
  });
  finishes.add(finished);
  finished.then(
    () => finishes.delete(finished),
    () => finishes.delete(finished)
  );
  async function wait<T>(get: () => T | undefined): Promise<T> {
    const existing = get();
    if (existing !== undefined) return existing;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        watchers.delete(check);
        reject(new Error(`Fixture barrier timed out: ${stderrDiagnostic(streams.stderr)}`));
      }, 10_000);
      const check = () => {
        const value = get();
        if (log.error) {
          clearTimeout(timer);
          watchers.delete(check);
          reject(log.error);
        } else if (value !== undefined) {
          clearTimeout(timer);
          watchers.delete(check);
          resolve(value);
        } else if (child.exitCode !== null || child.signalCode !== null) {
          clearTimeout(timer);
          watchers.delete(check);
          reject(new Error(`Fixture exited before barrier: ${stderrDiagnostic(streams.stderr)}`));
        }
      };
      watchers.add(check);
      check();
    });
  }
  return {
    finished,
    exited: exit.exited,
    exitWithin: exit.within,
    waitFor: (stage: string) => wait(() => log.events.find((event) => event.stage === stage)),
    waitForProcessCount: (stage: string, count: number) =>
      wait(() =>
        new Set(log.events.filter((event) => event.stage === stage).map((event) => event.pid))
          .size >= count
          ? true
          : undefined
      ),
    waitForListening: () => wait(() => streams.stdout.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0]),
    waitForOutput: () => wait(() => (streams.output.pending() ? true : undefined)),
    waitForErrorOutput: () => wait(() => (streams.error.pending() ? true : undefined)),
    resumeOutput: streams.output.resume,
    resumeError: streams.error.resume,
    closeOutput: () => child.stdout!.destroy(),
    closeError: () => child.stderr!.destroy(),
    send: (value: string) =>
      new Promise<void>((resolve, reject) =>
        child.send(value, (error) => (error ? reject(error) : resolve()))
      ),
    signal: (signal: NodeJS.Signals) => child.kill(signal),
  };
}

export async function stopChildren() {
  for (const [child, resume] of running) {
    child.kill("SIGKILL");
    resume();
  }
  await Promise.allSettled([...finishes]);
}

export function stages(result: Result) {
  return result.events.map((event) => event.stage);
}

function stderrDiagnostic(stderr: string) {
  return `${Buffer.byteLength(stderr)} stderr bytes; tail: ${JSON.stringify(stderr.slice(-512))}`;
}
