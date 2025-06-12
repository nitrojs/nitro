import { HTTPError } from "h3";

export default eventHandler(() => {
  throw new HTTPError({
    status: 503,
    statusText: "Service Unavailable",
  });
});
