import { defineHandler } from "nitro/h3";

export default defineHandler((event) => {
  const type = event.context.params!.type!;
  const link = `<a href='/api/param/body-${type}'>link</a>`;
  const isJSON = type.endsWith("json");

  return new Response(isJSON ? JSON.stringify({ link }) : link, {
    status: type.startsWith("error-") ? 500 : 200,
    headers: {
      "content-type": isJSON ? "application/json" : type === "text" ? "text/plain" : "text/html",
      "x-nitro-prerender": `/api/param/header-${type}`,
    },
  });
});
