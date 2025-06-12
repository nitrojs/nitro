import { HTTPError } from "h3";

export default defineHandler(() => {
  return new HTTPError({
    status: 400,
  });
});
