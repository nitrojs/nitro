import { appendFileSync } from "node:fs";

for (const [name, stream] of [
  ["stdout", process.stdout],
  ["stderr", process.stderr],
]) {
  const write = stream.write;
  stream.write = function (...args) {
    const callback = args.at(-1);
    if (typeof callback === "function") {
      args[args.length - 1] = function (...callbackArgs) {
        if (callbackArgs[0]?.code === "EPIPE" && process.env.TASK_CLI_EVENTS) {
          appendFileSync(
            process.env.TASK_CLI_EVENTS,
            JSON.stringify({ stage: `io:${name}:EPIPE`, pid: process.pid }) + "\n"
          );
        }
        return Reflect.apply(callback, this, callbackArgs);
      };
    }
    return Reflect.apply(write, this, args);
  };
}
