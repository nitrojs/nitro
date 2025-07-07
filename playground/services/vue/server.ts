import { renderToString } from "vue/server-renderer";
import { createApp } from "./main";

export default {
  async fetch(req: Request): Promise<Response> {
    const { app } = createApp();
    const ctx = {};
    const appHTML = await renderToString(app, ctx);
    return new Response(indexHTML(appHTML), {
      headers: {
        "Content-Type": "text/html",
      },
    });
  },
};

function indexHTML(appHTML: string) {
  return /* html */ `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite + Vue</title>
  </head>
  <body>
    <div id="app">${appHTML}</div>
    <script type="module" src="/services/vue/client.ts"></script>
  </body>
</html>`;
}
