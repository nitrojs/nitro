import { defineTask } from "nitro/task";

export default defineTask({
  meta: {
    description: "Send a notification",
  },
  async run({ payload }) {
    console.log(`Sending notification to ${payload.to}: ${payload.subject}`);
    return { result: "Notification sent" };
  },
});
