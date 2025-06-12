import { HTTPError } from "h3";

export default defineHandler((event) => {
  throw new HTTPError({ status: 500, statusText: "Test Error" });
});
