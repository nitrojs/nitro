import { createFileRoute } from "@tanstack/react-router";
import { createMiddleware, json } from "@tanstack/react-start";

const testMiddleware = createMiddleware().server(async ({ next }) => {
  const result = await next();
  result.response.headers.set("x-test", "true");
  return result;
});

export const Route = createFileRoute("/api/test")({
  server: {
    middleware: [testMiddleware],
    handlers: {
      GET: async ({ request }) => {
        return json({ api: "works!" });
      },
    },
  },
});
