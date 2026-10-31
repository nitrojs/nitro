import { defineTask } from "nitro/task";
import { mark } from "../../events.ts";

mark("handler:reject");
export default defineTask({
  async run() {
    mark("task:reject");
    await Promise.resolve();
    throw new Error("fixture task rejected");
  },
});
