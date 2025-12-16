import { HTTPError } from "nitro/h3";

export default () => {
  throw new HTTPError({
    status: 503,
    statusText: "Service Unavailable",
  });
};
