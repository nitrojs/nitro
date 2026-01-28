---
category: framework
---

# Express

> Use Express.js with Nitro.

## Project Structure

```
express/
├── server.node.ts        # Express app (Node.js specific)
├── nitro.config.ts
└── vite.config.ts
```

## How It Works

Create an Express app and export it as the default handler:

```ts [server.node.ts]
import Express from "express";

const app = Express();

app.use("/", (_req, res) => {
  res.send("Hello from Express with Nitro!");
});

export default app;
```

::note
The `.node.ts` suffix indicates this entry is Node.js specific.
::

## Learn More

- [Express Documentation](https://expressjs.com/)
