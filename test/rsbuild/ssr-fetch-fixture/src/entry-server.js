import clientAssets from "./entry-client.js?assets=client";
import serverAssets from "./entry-server.js?assets=ssr";

export default {
  async fetch(req) {
    const { pathname } = new URL(req.url);
    const { default: lazyAssets } = await import("./lazy.js?assets");
    if (pathname.endsWith("/_assets")) {
      return Response.json({
        client: clientAssets,
        server: serverAssets,
        lazy: lazyAssets,
        merged: clientAssets.merge(serverAssets, lazyAssets),
      });
    }
    // Async chunk of the server environment (e.g. lazy routes of a framework)
    const { renderPage } = await import("./page.js");
    const html = /* html */ `<!doctype html>
<html>
  <head>
    ${clientAssets.css.map(({ href }) => `<link rel="stylesheet" href="${href}">`).join("")}
    ${clientAssets.js.map(({ href }) => `<script defer src="${href}"></script>`).join("")}
  </head>
  <body><div id="app">${renderPage(pathname)}</div></body>
</html>`;
    return new Response(html, { headers: { "content-type": "text/html" } });
  },
};
