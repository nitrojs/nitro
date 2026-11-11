import { defineHandler, HTTPError } from "nitro";

export default defineHandler(() => {
  throw new HTTPError({ status: 418, message: "teapot" });
});
