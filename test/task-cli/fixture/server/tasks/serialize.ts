import { defineTask } from "nitro/task";
import { mark } from "../../events.ts";

export default defineTask({
  run() {
    mark("task:serialize");
    return { result: 1n };
  },
});
