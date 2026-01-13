import { renderToReadableStream } from "react-dom/server.edge";

import { App } from "@/app/app.tsx";

import clientAssets from "./client?assets=client";
import serverAssets from "./server?assets=ssr";
import { Router } from "wouter";

export default {
  async fetch(req: Request) {
    const assets = clientAssets.merge(serverAssets);

    const ssrContext = {};

    const url = new URL(req.url);

    return new Response(
      await renderToReadableStream(
        <html lang="en">
          <head>
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1.0"
            />
            {assets.css.map((attr: any) => (
              <link key={attr.href} rel="stylesheet" {...attr} />
            ))}
            {assets.js.map((attr: any) => (
              <link key={attr.href} type="modulepreload" {...attr} />
            ))}
            <script type="module" src={assets.entry} />
          </head>
          <body id="app">
            <Router
              ssrPath={url.pathname}
              ssrSearch={url.search}
              ssrContext={ssrContext}
            >
              <App />
            </Router>
          </body>
        </html>
      ),
      { headers: { "Content-Type": "text/html;charset=utf-8" } }
    );
  },
};
