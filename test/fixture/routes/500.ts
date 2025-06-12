import { HTTPError } from "h3";

export default defineEventHandler((event) => {
  throw new HTTPError({ status: 500, statusText: "Test Error" });
});
