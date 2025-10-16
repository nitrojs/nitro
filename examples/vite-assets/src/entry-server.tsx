import "./styles.css";
import { renderToReadableStream } from "preact-render-to-string/stream";
import clientAssets from "./entry-client?assets=client";
import serverAssets from "./entry-server?assets=ssr";
import { Counter } from "./counter";

export default {
  async fetch(request: Request) {
    const url = new URL(request.url);
    const htmlStream = renderToReadableStream(<Root url={url} />);
    return new Response(htmlStream, {
      headers: { "Content-Type": "text/html;charset=utf-8" },
    });
  },
};

function Root(props: { url: URL }) {
  const assets = clientAssets.merge(serverAssets);
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Vite Assets Example</title>
        {assets.css.map((attr) => (
          <link key={attr.href} rel="stylesheet" {...attr} />
        ))}
        {assets.js.map((attr) => (
          <link key={attr.href} type="modulepreload" {...attr} />
        ))}
        <script type="module" src={assets.entry} />
      </head>
      <body>
        <h1 className="hero">Vite Assets Example</h1>
        <p>URL: {props.url.href}</p>
        <div id="counter">
          <Counter />
        </div>
      </body>
    </html>
  );
}
