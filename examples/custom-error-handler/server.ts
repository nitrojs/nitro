import { defineHandler, HTTPError } from "nitro";

export default defineHandler(() => {
  throw new HTTPError("Example Error!", { status: 500 });
});
