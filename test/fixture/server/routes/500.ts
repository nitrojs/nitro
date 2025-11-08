import { HTTPError } from "nitro/h3";

export default () => {
  throw new HTTPError({ status: 500, statusText: "Test Error" });
};
