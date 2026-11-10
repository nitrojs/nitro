import { defineHandler } from "nitro";

export default defineHandler((event) => {
  const { pathname } = event.url;
  if (pathname.endsWith(".png")) {
    return new Response(`png:${pathname}`, { headers: { "content-type": "image/png" } });
  }
  return new Response(`<p>catchall:${pathname}</p>`, {
    headers: { "content-type": "text/html" },
  });
});
