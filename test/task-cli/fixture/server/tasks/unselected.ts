import { defineTask } from "nitro/task";
import { mark } from "../../events.ts";

mark("handler:unselected");
export default defineTask({ run: () => ({ result: "unused" }) });
