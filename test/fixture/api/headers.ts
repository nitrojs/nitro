export default defineEventHandler((event) => {
  setHeader(event, "x-foo", "bar");
  setHeader(event, "x-array", ["foo", "bar"]);

  // setHeader(event, "Set-Cookie", "foo=bar, bar=baz");
  appendHeader(event, "Set-Cookie", "foo=bar");
  appendHeader(event, "Set-Cookie", "bar=baz");
  setCookie(event, "test", "value");
  setCookie(event, "test2", "value");

  return "headers sent";
});
