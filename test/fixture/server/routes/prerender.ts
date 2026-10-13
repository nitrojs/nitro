import { defineHandler } from "nitro/h3";

export default defineHandler((event) => {
  const links = [
    "/404",
    "https://about.google/products/",
    "/api/hello?bar=baz",
    "/api/hello?bar=baz&bing=bap",
    "/api/hello?bar=baz&amp;foo=qux",
    "/prerender#foo",
    "../api/hey",
    "/json-string",
    event.url.href.includes("?") ? "/api/param/hidden" : "/prerender?withQuery",
  ];

  event.res.headers.append("x-nitro-prerender", "/api/param/prerender1, /api/param/prerender2");
  event.res.headers.append("x-nitro-prerender", "/api/param/prerender3");

  event.res.headers.set("content-type", "text/html");
  return /* html */ `<!DOCTYPE html><html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Prerendered routes test</title>
</head>
<body>
  <h1>Prerendered routes test:</h1>
  <ul>
${links.map((link) => `    <li><a href="${link}">${link}</a></li>`).join("\n")}
  </ul>
  <!-- Bad link Examples -->
  <link rel="icon" href="data:image/png;base64,aaa//bbbbbb/ccc">
  <a x-href="/500?x-href">x-href attr</a>
  &lt;a href=&quot;/500&lt;/a&gt;
  <a href='#a'>#a</a>
  <a href='%23b'>#b</a>
</body>
</html>`;
});
