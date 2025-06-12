import { HTTPError } from "h3";

export default defineHandler(() => {
  throw new HTTPError({
    status: 503,
    statusText: "Service Unavailable",
  });
});
