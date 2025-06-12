import { HTTPError } from "h3";

export default defineEventHandler(() => {
  return new HTTPError({
    status: 400,
  });
});
