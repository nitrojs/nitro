---
category: deploy
icon: i-simple-icons-vercel
---

# Vercel Queues

> Process background work asynchronously with Vercel Queues and Nitro tasks.

<!-- automd:ui-code-tree src="../../examples/vercel-queues" default="nitro.config.ts" ignore="README.md,GUIDE.md" expandAll -->

::code-tree{defaultValue="nitro.config.ts" expandAll}

```ts [nitro.config.ts]
import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: ".",
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

```json [package.json]
{
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build"
  },
  "devDependencies": {
    "@vercel/queue": "^0.1.4",
    "nitro": "latest"
  }
}
```

```json [tsconfig.json]
{
  "extends": "nitro/tsconfig"
}
```

```ts [vite.config.ts]
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({ plugins: [nitro()] });
```

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

```ts [routes/send.ts]
import { send } from "@vercel/queue";
import { defineHandler, HTTPError } from "nitro";

export default defineHandler(async (event) => {
  const body = (await event.req.json()) as Record<string, unknown>;
  if (!body.to || !body.subject || !body.body) {
    throw new HTTPError({
      status: 400,
      message: "Missing required fields `to`, `subject` or `body`",
    });
  }

  const { messageId } = await send("notifications", {
    to: body.to,
    subject: body.subject,
    body: body.body,
  });
  return { messageId };
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

::

<!-- /automd -->

<!-- automd:file src="../../examples/vercel-queues/README.md" -->

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

<!-- /automd -->

## Learn More

- [Vercel Deployment](/deploy/providers/vercel)
- [Tasks](/docs/tasks)
