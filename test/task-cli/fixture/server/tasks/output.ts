import { defineTask } from "nitro/task";
import { mark } from "../../events.ts";

declare global {
  var __taskCLIOutputBanner: string | undefined;
}

export default defineTask({
  run() {
    mark("task:output");
    return { result: { value: "OUTPUT_SENTINEL", banner: globalThis.__taskCLIOutputBanner } };
  },
});
