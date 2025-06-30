import { eventHandler, type EventHandler } from "h3";
import { useRuntimeConfig } from "../config";
import { kebabCase } from "scule";
import type { SpecRendererNitroConfig } from "@kong/spec-renderer";

// Helper function to convert object properties to HTML attributes
function objectToAttributes(obj: Record<string, any>): string {
  return Object.entries(obj)
    .filter(
      ([_, value]) =>
        value !== null &&
        value !== undefined &&
        String(value || "").trim() !== ""
    )
    .map(([key, value]) => {
      const attrName = kebabCase(key);
      // Always include attribute="value" format for all types including booleans
      return `${attrName}="${String(value).replace(/"/g, "&quot;")}"`;
    })
    .filter(Boolean)
    .join(" ");
}

export default eventHandler((event) => {
  const runtimeConfig = useRuntimeConfig(event);
  const title = runtimeConfig.nitro.openAPI?.meta?.title || "API Reference";
  const description = runtimeConfig.nitro.openAPI?.meta?.description || "";
  const openAPIEndpoint =
    runtimeConfig.nitro.openAPI?.route || "./_openapi.json";

  // https://github.com/Kong/spec-renderer
  const _config = runtimeConfig.nitro.openAPI?.ui
    ?.kong as SpecRendererNitroConfig & { route?: string };
  const kongSpecRendererConfig: SpecRendererNitroConfig = {
    ..._config,
    specUrl: openAPIEndpoint,
    navigationType: "hash", // use hash navigation for better compatibility
    hideInsomniaTryIt: true,
    showPoweredBy: true, // Enforce the "Powered by Kong" is always shown
    basePath: _config?.route || "/_kong",
  };

  const componentAttributes = objectToAttributes(kongSpecRendererConfig);
  const CDN_BASE = "https://cdn.jsdelivr.net/npm/@kong/spec-renderer@^1";

  return /* html */ `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="${description}" />
        <title>${title}</title>
        <!-- Include Kong Spec Renderer styles for content teleported out of web component. -->
        <link rel="stylesheet" href="${CDN_BASE}/dist/spec-renderer.css" />
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap" rel="stylesheet">
        <style>
        html, body { padding: 0; margin: 0; height: 100%;}
        body { font-family: 'Inter', Roboto, Helvetica, sans-serif; }
        </style>
      </head>
      <body>
        <kong-spec-renderer spec="" ${componentAttributes} />
        <script type="module">
        import { registerKongSpecRenderer } from '${CDN_BASE}/dist/kong-spec-renderer.web-component.es.js'
        // Check if hash exists and set current-path
        const hash = window.location.hash;
        if (hash) {
          const path = hash.substring(1); // Remove the # character
          const renderer = document.querySelector('kong-spec-renderer');
          if (renderer) {
            renderer.setAttribute('current-path', path);
          }
        }
        registerKongSpecRenderer()
        </script>
      </body>
    </html>`;
}) as EventHandler;
