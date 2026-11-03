import { renderToReadableStream } from "react-dom/server.edge";
import { App } from "./app.tsx";

import clientAssets from "./entry-client.tsx?assets=client";

export default {
  async fetch(_req: Request) {
    return new Response(
      await renderToReadableStream(
        <html lang="en">
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            {clientAssets.css.map((attr) => (
              <link key={attr.href} rel="stylesheet" {...attr} />
            ))}
            {clientAssets.js.map((attr) => (
              <script key={attr.href} defer src={attr.href} />
            ))}
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
