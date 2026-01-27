import "./styles.css";
import { renderToReadableStream } from "react-dom/server.edge";
import { App } from "./app.tsx";

import clientAssets from "./entry-client?assets=client";
import serverAssets from "./entry-server?assets=ssr";

export default {
  async fetch(_req: Request) {
    const assets = clientAssets.merge(serverAssets);
    return new Response(
      await renderToReadableStream(
        <html lang="en">
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            {assets.css.map((attr: any) => (
              <link key={attr.href} rel="stylesheet" {...attr} />
            ))}
            {assets.js.map((attr: any) => (
              <link key={attr.href} type="modulepreload" {...attr} />
            ))}
            <script type="module" src={assets.entry} />
          </head>
          <body id="app">
            <App />
          </body>
        </html>
      ),
      { headers: { "Content-Type": "text/html;charset=utf-8" } }
    );
  },
};
