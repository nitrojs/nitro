import { H3Event, HTTPError } from "nitro/h3";

export default (event: H3Event) => {
  event.res.headers.set("x-success-only", "1");
  event.res.errHeaders.set("x-err-header", "err-value");
  event.res.errHeaders.append("set-cookie", "err=1; Path=/");

  if (event.url.searchParams.has("unhandled")) {
    throw new Error("Unhandled error");
  }

  throw new HTTPError({ status: 403, message: "Forbidden" });
};
