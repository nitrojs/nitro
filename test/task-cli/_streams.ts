import type { ChildProcessWithoutNullStreams } from "node:child_process";
import type { Readable } from "node:stream";

export function observeStreams(
  child: Pick<ChildProcessWithoutNullStreams, "stdout" | "stderr">,
  options: { pauseStdout?: boolean; pauseStderr?: boolean },
  notify: () => void
) {
  let stdout = "",
    stderr = "";
  const output = observe(child.stdout, options.pauseStdout, (text) => {
    stdout += text;
  });
  const error = observe(child.stderr, options.pauseStderr, (text) => {
    stderr += text;
  });
  function observe(stream: Readable, paused: boolean | undefined, append: (text: string) => void) {
    stream.setEncoding("utf8");
    stream.on("data", (text: string) => {
      append(text);
      notify();
    });
    if (paused) {
      stream.pause();
      stream.on("readable", notify);
    }
    return {
      pending: () => stream.readableLength > 0,
      resume: () => {
        stream.off("readable", notify);
        stream.resume();
      },
    };
  }
  return {
    get stdout() {
      return stdout;
    },
    get stderr() {
      return stderr;
    },
    output,
    error,
    resume: () => {
      output.resume();
      error.resume();
    },
  };
}
