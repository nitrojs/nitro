import type { ApiReferenceConfiguration } from "@scalar/api-reference";
import { defineHandler, type EventHandler } from "h3";
import { useRuntimeConfig } from "../runtime-config.ts";

// Served as /_scalar
export default defineHandler((event) => {
  const runtimeConfig = useRuntimeConfig();
  const title = runtimeConfig.nitro?.openAPI?.meta?.title || "API Reference";
  const description = runtimeConfig.nitro?.openAPI?.meta?.description || "";
  const openAPIEndpoint = runtimeConfig.nitro?.openAPI?.route || "./_openapi.json";

  // https://github.com/scalar/scalar
  const _config = runtimeConfig.nitro?.openAPI?.ui?.scalar as ApiReferenceConfiguration;
  const scalarConfig: ApiReferenceConfiguration = {
    ..._config,
    url: openAPIEndpoint,
    // @ts-expect-error
    spec: { url: openAPIEndpoint, ..._config?.spec },
  };

  // The default page title

  event.res.headers.set("Content-Type", "text/html");
  return /* html */ `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="${description}" />
        <title>${title}</title>
        <style>
          ${scalarConfig.theme ? null : customTheme}
        </style>
      </head>
      <body>
        <script
          id="api-reference"
          data-configuration="${JSON.stringify(scalarConfig).split('"').join("&quot;")}"
        ></script>
        <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
      </body>
    </html>`;
}) as EventHandler;

const customTheme = /* css */ `/* basic theme */
  .light-mode,
  .light-mode .dark-mode {
    --theme-background-1: #fff;
    --theme-background-2: #fafafa;
    --theme-background-3: rgb(245 245 245);

    --theme-color-1: #2a2f45;
    --theme-color-2: #757575;
    --theme-color-3: #8e8e8e;

    --theme-color-accent: #ef4444;
    --theme-background-accent: transparent;

    --theme-border-color: rgba(0, 0, 0, 0.1);
  }
  .dark-mode {
    --theme-background-1: #171717;
    --theme-background-2: #262626;
    --theme-background-3: #2e2e2e;

    --theme-color-1: rgba(255, 255, 255, 0.9);
    --theme-color-2: rgba(255, 255, 255, 0.62);
    --theme-color-3: rgba(255, 255, 255, 0.44);

    --theme-color-accent: #f87171;
    --theme-background-accent: transparent;

    --theme-border-color: rgba(255, 255, 255, 0.1);
  }

  /* Document Sidebar */
  .light-mode .t-doc__sidebar,
  .dark-mode .t-doc__sidebar {
    --sidebar-background-1: var(--theme-background-1);
    --sidebar-color-1: var(--theme-color-1);
    --sidebar-color-2: var(--theme-color-2);
    --sidebar-border-color: var(--theme-border-color);

    --sidebar-item-hover-background: transparent;
    --sidebar-item-hover-color: var(--sidebar-color-1);

    --sidebar-item-active-background: var(--theme-background-accent);
    --sidebar-color-active: var(--theme-color-accent);

    --sidebar-search-background: transparent;
    --sidebar-search-color: var(--theme-color-3);
    --sidebar-search-border-color: var(--theme-border-color);
  }

  /* advanced */
  .light-mode .dark-mode,
  .light-mode {
    --theme-color-green: #91b859;
    --theme-color-red: #e53935;
    --theme-color-yellow: #e2931d;
    --theme-color-blue: #6182b8;
    --theme-color-orange: #f76d47;
    --theme-color-purple: #9c3eda;
  }
  .dark-mode {
    --theme-color-green: #c3e88d;
    --theme-color-red: #f07178;
    --theme-color-yellow: #ffcb6b;
    --theme-color-blue: #82aaff;
    --theme-color-orange: #f78c6c;
    --theme-color-purple: #c792ea;
  }
  /* custom-theme */
  .section-container:nth-of-type(2)
    ~ .section-container
    .scalar-card
    .scalar-card-header {
    --theme-background-2: var(--theme-background-1) !important;
  }
  .section-flare {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    animation: spin 39s linear infinite;
    transition: all 0.3s ease-in-out;
    opacity: 1;
  }
  .section-flare-item:nth-of-type(1),
  .section-flare-item:nth-of-type(2),
  .section-flare-item:nth-of-type(3) {
    content: "";
    width: 1000px;
    height: 1000px;
    position: absolute;
    top: 0;
    right: 0;
    border-radius: 50%;
    background: var(--default-theme-background-1);
    display: block;
    opacity: 1;
    filter: blur(48px);
    -webkit-backface-visibility: hidden;
    -webkit-perspective: 1000;
    -webkit-transform: translate3d(0, 0, 0);
    -webkit-transform: translateZ(0);
    perspective: 1000;
    transform: translate3d(0, 0, 0);
    transform: translateZ(0);
  }
  .section-flare-item:nth-of-type(2) {
    top: initial;
    right: initial;
    background: #ef4444;
    width: 700px;
    height: 700px;
    opacity: 0.3;
    animation: sectionflare 37s linear infinite;
  }
  .section-flare-item:nth-of-type(1) {
    top: initial;
    right: initial;
    bottom: 0;
    left: -20px;
    background: #ef4444;
    width: 500px;
    height: 500px;
    opacity: 0.3;
    animation: sectionflare2 38s linear infinite;
  }
  @keyframes sectionflare {
    0%,
    100% {
      transform: translate3d(0, 0, 0);
    }
    50% {
      transform: translate3d(525px, 525px, 0);
    }
  }
  @keyframes sectionflare2 {
    0%,
    100% {
      transform: translate3d(700px, 700px, 0);
    }
    50% {
      transform: translate3d(0, 0, 0);
    }
  }
  @keyframes spin {
    100% {
      transform: rotate(360deg);
    }
  }
  .section-container:nth-of-type(2) {
    overflow: hidden;
  }`;
