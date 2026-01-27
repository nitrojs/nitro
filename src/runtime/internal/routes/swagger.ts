import { defineHandler } from "h3";
import type { EventHandler } from "h3";
import { useRuntimeConfig } from "../runtime-config.ts";

// https://github.com/swagger-api/swagger-ui

export default defineHandler((event) => {
  const runtimeConfig = useRuntimeConfig();
  const title = runtimeConfig.nitro?.openAPI?.meta?.title || "API Reference";
  const description = runtimeConfig.nitro?.openAPI?.meta?.description || "";
  const openAPIEndpoint = runtimeConfig.nitro?.openAPI?.route || "./_openapi.json";

  const CDN_BASE = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@^5";
  event.res.headers.set("Content-Type", "text/html");
  return /* html */ `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="${description}" />
        <title>${title}</title>
        <link rel="stylesheet" href="${CDN_BASE}/swagger-ui.css" />
      </head>
      <body>
        <div id="swagger-ui"></div>
        <script src="${CDN_BASE}/swagger-ui-bundle.js" crossorigin></script>
        <script
          src="${CDN_BASE}/swagger-ui-standalone-preset.js"
          crossorigin
        ></script>
        <script>
          window.onload = () => {
            window.ui = SwaggerUIBundle({
              url: ${JSON.stringify(openAPIEndpoint)},
              dom_id: "#swagger-ui",
              presets: [
                SwaggerUIBundle.presets.apis,
                SwaggerUIStandalonePreset,
              ],
              layout2: "StandaloneLayout",
            });
          };
        </script>
      </body>
    </html> `;
}) as EventHandler;
