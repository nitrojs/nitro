import { defineNitroErrorHandler } from "nitro/runtime";

export default defineNitroErrorHandler((error, event) => {
  return new Response(`Custom Error Handler: ${error.message}`, {
    status: 500,
    headers: { "Content-Type": "text/plain" },
  });
});
