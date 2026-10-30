import { defineTask } from "nitro/task";
import { useRuntimeConfig } from "nitro/runtime-config";
import { mark, ready } from "../../../events.ts";

mark("handler:echo");
export default defineTask({
  meta: { description: "handler metadata must not be read by list" },
  run({ payload }) {
    mark("task:echo");
    return {
      result: {
        payload,
        ready,
        sample: useRuntimeConfig().sample,
        ...(typeof payload.responseBytes === "number"
          ? { large: "x".repeat(payload.responseBytes) }
          : {}),
      },
    };
  },
});
