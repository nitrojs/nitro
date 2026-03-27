import { runTask } from "nitro/task";
import { definePlugin } from "nitro";

export default definePlugin((nitro) => {
  nitro.hooks.hook("vercel:queue", async ({ message, metadata }) => {
    if (metadata.topicName === "notifications") {
      await runTask("notifications:send", {
        payload: message as Record<string, unknown>,
      });
    }
  });
});
