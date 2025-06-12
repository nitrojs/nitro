import { HTTPError } from "h3";

export default eventHandler((event) => {
  throw new HTTPError("This file should be ignored!");
});
