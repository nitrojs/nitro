import { renderToString } from "react-dom/server";
import App from "./App.js";

export default {
  async fetch(req: Request): Promise<Response> {
    const appHTML = await renderToString(<App />);
    return new Response(indexHTML(appHTML), {
      headers: { "Content-Type": "text/html" },
    });
  },
};

function indexHTML(appHTML: string) {
  return /* html */ `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>body { margin: 0; }</style>
    <title>Vite + Nitro + React</title>
    ${
      import.meta.env?.DEV
        ? '<script type="module" src="/@vite/client"></script>'
        : ""
    }
  </head>
  <body>
    <div id="app">${appHTML}</div>
    <script type="module" src="${resolveEntry("app/client.tsx")}"></script>
  </body>
</html>`;
}

function resolveEntry(entry: string): string {
  if (import.meta.env?.PROD) {
    const manifest = (globalThis as any).__VITE_MANIFEST__;
    const file = manifest?.[entry]?.file;
    if (!file) {
      throw new Error(
        manifest
          ? `Entry "${entry}" not found in Vite manifest.`
          : "Vite manifest is not available."
      );
    }
    return `/${file}`;
  }
  return `/${entry}`;
}
