import { defineTask } from "nitro/task";
import { mark } from "../../events.ts";
import { fixtureError } from "../../errors.ts";

mark("handler:throw");
export default defineTask({
  run() {
    mark("task:throw");
    throw fixtureError("fixture task threw");
  },
});
