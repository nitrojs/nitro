import { renderToString } from "react-dom/server";
import App from "./App.jsx";

export default {
  async fetch(req: Request): Promise<Response> {
    const appHTML = await renderToString(<App />);
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
    <title>Vite + Nitro + React</title>
  </head>
  <body>
    <div id="app">${appHTML}</div>
    <script type="module" src="/services/react/client.tsx"></script>
  </body>
</html>`;
}
