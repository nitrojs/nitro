import { defineHandler, HTTPError } from "nitro/h3";

export default defineHandler(() => {
  throw new HTTPError({ status: 503, message: "Unavailable" });
});
