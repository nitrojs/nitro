import { defineHandler, handleCors, HTTPError } from "nitro/h3";

export default defineHandler((event) => {
  handleCors(event, { origin: "*" });
  event.res.headers.set("x-success-only", "true");
  event.res.errHeaders.set("x-error-precedence", "staged");
  event.res.errHeaders.append("set-cookie", "staged=1; Path=/");
  throw new HTTPError({
    status: 401,
    message: "unauthorized",
    headers: {
      "x-error-precedence": "error",
      "set-cookie": "error=1; Path=/",
    },
  });
});
