import { defineHandler, HTTPError } from "nitro/h3";

export default defineHandler(() => {
  throw new HTTPError("Example Error!", { status: 500 });
});
