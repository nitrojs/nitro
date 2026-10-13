import { HTTPError } from "nitro/h3";

export default () => {
  throw new HTTPError("This file should be ignored!");
};
