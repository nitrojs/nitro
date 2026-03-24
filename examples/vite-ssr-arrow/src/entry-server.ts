import "./styles.css";
import { renderToString } from "@arrow-js/ssr";
import { App } from "./app.ts";

import clientAssets from "./entry-client?assets=client";
import serverAssets from "./entry-server?assets=ssr";

export default {
  async fetch(_req: Request) {
    const assets = clientAssets.merge(serverAssets);
    const view = App();
    const result = await renderToString(view);

    const head = [
      `<meta name="viewport" content="width=device-width, initial-scale=1.0" />`,
      ...assets.css.map(
        (attr: Record<string, string>) =>
          `<link rel="stylesheet" href="${attr.href}" />`
      ),
      ...assets.js.map(
        (attr: Record<string, string>) =>
          `<link rel="modulepreload" href="${attr.href}" />`
      ),
      `<script type="module" src="${assets.entry}"></script>`,
    ].join("\n    ");

    const html = `<!doctype html>
<html lang="en">
  <head>
    ${head}
  </head>
  <body>
    <div id="app">${result.html}</div>
  </body>
</html>`;

    return new Response(html, {
      headers: { "Content-Type": "text/html;charset=utf-8" },
    });
  },
};
