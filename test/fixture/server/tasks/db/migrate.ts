import { defineTask } from "nitro/task";

export default defineTask({
  meta: {
    description: "Run database migrations",
  },
  run() {
    return { result: "Success" };
  },
});
