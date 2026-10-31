import { defineTask } from "nitro/task";
import { mark, waitForRelease } from "../../events.ts";

mark("handler:block");
export default defineTask({
  async run() {
    const release = process.env.TASK_CLI_CLOSE_ABORT_TASK
      ? new Promise<void>((_resolve, reject) => {
          globalThis.__taskCliRejectPending = reject;
        })
      : waitForRelease();
    mark("task:waiting");
    await release;
    mark("task:released");
    return { result: "released" };
  },
});
