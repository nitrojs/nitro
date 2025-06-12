import { HTTPError } from "h3";

export default defineHandler((event) => {
  throw new HTTPError("This file should be ignored!");
});
