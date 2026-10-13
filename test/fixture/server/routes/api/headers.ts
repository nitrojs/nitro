import { defineHandler, setCookie } from "nitro/h3";

export default defineHandler((event) => {
  event.res.headers.set("x-foo", "bar");
  event.res.headers.append("x-array", "foo");
  event.res.headers.append("x-array", "bar");

  // setHeader(event, "Set-Cookie", "foo=bar, bar=baz");
  event.res.headers.append("Set-Cookie", "foo=bar");
  event.res.headers.append("Set-Cookie", "bar=baz");
  setCookie(event, "test", "value");
  setCookie(event, "test2", "value");

  return "headers sent";
});
