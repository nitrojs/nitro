---
category: features
---

# Hello World

> Minimal Nitro server using the web standard fetch handler.

## Project Structure

```
hello-world/
├── server.ts         # Main server entry
├── nitro.config.ts   # Nitro configuration
└── vite.config.ts    # Vite configuration
```

## How It Works

The `server.ts` file exports a default object with a `fetch` method that follows the web standard Fetch API:

```ts [server.ts]
export default {
  fetch(req: Request) {
    return new Response("Nitro Works!");
  },
};
```

This is the foundation of all Nitro servers. The `fetch` handler receives a standard `Request` object and returns a `Response`.

## Learn More

- [Server Entry](/docs/server-entry)
