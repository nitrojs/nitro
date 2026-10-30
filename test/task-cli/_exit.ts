import type { ChildProcess } from "node:child_process";

export interface ExitStatus {
  code: number | null;
  signal: NodeJS.Signals | null;
  error?: string;
}

export function observeExit(child: ChildProcess) {
  let status: ExitStatus | undefined;
  const exited = new Promise<ExitStatus>((resolve) => {
    const finish = (value: ExitStatus) => {
      status = value;
      resolve(value);
    };
    child.once("exit", (code, signal) => finish({ code, signal }));
    child.once("error", (error) => finish({ code: null, signal: null, error: error.message }));
  });
  return {
    exited,
    async within(milliseconds: number): Promise<ExitStatus & { exited: boolean }> {
      if (status) return { ...status, exited: true };
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          exited.then((value) => ({ ...value, exited: true })),
          new Promise<ExitStatus & { exited: boolean }>((resolve) => {
            timer = setTimeout(
              () => resolve({ exited: false, code: child.exitCode, signal: child.signalCode }),
              milliseconds
            );
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
