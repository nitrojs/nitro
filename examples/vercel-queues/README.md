Nitro integrates with [Vercel Queues](https://vercel.com/docs/queues) to process background work asynchronously.

## Configuration

Add queue triggers to your Nitro config. Nitro registers a queue consumer handler and makes incoming messages available via the `vercel:queue` runtime hook.

```ts [nitro.config.ts]
import { defineConfig } from "nitro";

export default defineConfig({
  experimental: {
    tasks: true,
  },
  vercel: {
    queues: {
      triggers: [{ topic: "notifications" }],
    },
  },
});
```

## Sending Messages

Use the `@vercel/queue` SDK to send messages to a topic from any route.

```ts [routes/send.ts]
import { send } from "@vercel/queue";
import { defineHandler } from "nitro";

export default defineHandler(async (event) => {
  const body = await event.req.json();
  const { messageId } = await send("notifications", {
    to: body.to,
    subject: body.subject,
    body: body.body,
  });
  return { messageId };
});
```

## Processing Messages

Listen for the `vercel:queue` hook in a plugin to handle incoming messages. This example dispatches them to a Nitro task.

```ts [plugins/queue.ts]
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
```

```ts [tasks/notifications/send.ts]
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
```
