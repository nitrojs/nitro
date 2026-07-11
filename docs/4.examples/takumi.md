---
category: integrations
icon: i-lucide-image
---

# Takumi

> Generate dynamic Open Graph images from a Nitro route using Takumi.

<!-- automd:ui-code-tree src="../../examples/takumi" default="routes/og.png.ts" ignore="README.md,GUIDE.md" expandAll -->

::code-tree{defaultValue="routes/og.png.ts" expandAll}

```html [index.html]
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Takumi + Nitro — OG Images</title>

    <!-- Open Graph / social preview, rendered on the fly by /og.png -->
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Takumi + Nitro" />
    <meta property="og:description" content="Render OG images from a Nitro route." />
    <meta
      property="og:image"
      content="/og.png?title=Takumi%20%2B%20Nitro&description=Render%20OG%20images%20from%20a%20Nitro%20route."
    />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="/og.png" />

    <!-- Start fetching the initial preview in parallel with parsing, ahead of the script's own fetch() -->
    <link
      rel="preload"
      as="image"
      href="/og.png?title=Takumi%20%2B%20Nitro&description=Render%20OG%20images%20from%20a%20Nitro%20route."
    />

    <style>
      :root {
        color-scheme: light dark;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        font-family:
          ui-sans-serif,
          system-ui,
          -apple-system,
          "Segoe UI",
          Roboto,
          sans-serif;
        background: linear-gradient(to bottom right, #fff1f2, #fecdd3);
        color: #111827;
      }
      .card {
        width: 100%;
        max-width: 680px;
        background: rgba(255, 255, 255, 0.7);
        backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.6);
        border-radius: 20px;
        padding: 32px;
        box-shadow: 0 20px 45px rgba(190, 24, 93, 0.15);
      }
      h1 {
        margin: 0 0 4px;
        font-size: 28px;
      }
      p.lead {
        margin: 0 0 20px;
        color: #4b5563;
      }
      .preview-wrap {
        position: relative;
      }
      img.preview {
        display: block;
        width: 100%;
        height: auto;
        aspect-ratio: 1200 / 630;
        background: rgba(0, 0, 0, 0.04);
        border-radius: 12px;
        border: 1px solid rgba(0, 0, 0, 0.08);
      }
      .timing-badge {
        position: absolute;
        right: 10px;
        bottom: 10px;
        padding: 4px 10px;
        border-radius: 999px;
        background: rgba(17, 24, 39, 0.72);
        color: #fff;
        font-size: 12px;
        line-height: 1.4;
        backdrop-filter: blur(4px);
      }
      .timing-badge[data-pending] {
        opacity: 0.7;
      }
      .header-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .icon-link {
        display: inline-flex;
        flex-shrink: 0;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border-radius: 999px;
        background: rgba(0, 0, 0, 0.06);
        color: #4b5563;
      }
      .icon-link:hover {
        background: rgba(0, 0, 0, 0.12);
        color: #111827;
      }
      .controls {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 20px 0 8px;
      }
      .controls input {
        flex: 1 1 200px;
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px solid rgba(0, 0, 0, 0.15);
        font-size: 14px;
      }
      .controls button {
        padding: 10px 18px;
        border-radius: 10px;
        border: none;
        background: #be185d;
        color: #fff;
        font-size: 14px;
        cursor: pointer;
      }
      .controls button:hover {
        background: #9d174d;
      }
      code {
        font-family: ui-monospace, "SFMono-Regular", Menlo, monospace;
        background: rgba(0, 0, 0, 0.06);
        padding: 2px 6px;
        border-radius: 6px;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <div class="header-row">
        <h1>Takumi + Nitro</h1>
        <a
          id="endpoint-link"
          class="icon-link"
          href="/og.png?title=Takumi%20%2B%20Nitro&description=Render%20OG%20images%20from%20a%20Nitro%20route."
          target="_blank"
          rel="noopener"
          title="Open raw endpoint"
          aria-label="Open raw endpoint"
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      </div>
      <p class="lead">
        The image below is generated at request time by the
        <code>routes/og.png.ts</code> handler.
      </p>

      <div class="preview-wrap">
        <img
          id="preview"
          class="preview"
          alt="Generated Open Graph image"
          width="1200"
          height="630"
          src="/og.png?title=Takumi%20%2B%20Nitro&description=Render%20OG%20images%20from%20a%20Nitro%20route."
        />
        <span id="timing" class="timing-badge" data-pending>Generating…</span>
      </div>

      <div class="controls">
        <input id="title" placeholder="Title" value="Takumi + Nitro" />
        <input
          id="description"
          placeholder="Description"
          value="Render OG images from a Nitro route."
        />
      </div>
    </main>

    <script>
      const preview = document.getElementById("preview");
      const titleInput = document.getElementById("title");
      const descInput = document.getElementById("description");
      const timing = document.getElementById("timing");
      const endpointLink = document.getElementById("endpoint-link");

      let requestId = 0;

      function formatServerTiming(header) {
        const match = header?.match(/dur=([\d.]+)/);
        return match ? `${Math.round(Number(match[1]))} ms` : "—";
      }

      async function loadPreview(url) {
        const id = ++requestId;
        timing.textContent = "Generating…";
        timing.toggleAttribute("data-pending", true);
        const res = await fetch(url);
        const blob = await res.blob();
        if (id !== requestId) return; // a newer keystroke already superseded this request
        if (preview.src.startsWith("blob:")) URL.revokeObjectURL(preview.src);
        preview.src = URL.createObjectURL(blob);
        timing.textContent = formatServerTiming(res.headers.get("Server-Timing"));
        timing.toggleAttribute("data-pending", false);
      }

      function refresh() {
        const params = new URLSearchParams({
          title: titleInput.value,
          description: descInput.value,
        });
        const url = `/og.png?${params.toString()}`;
        endpointLink.href = url;
        loadPreview(url);
      }

      let debounceTimer;
      function refreshDebounced() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(refresh, 300);
      }

      titleInput.addEventListener("input", refreshDebounced);
      descInput.addEventListener("input", refreshDebounced);

      loadPreview(preview.src);
    </script>
  </body>
</html>
```

```ts [nitro.config.ts]
import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: "./",
});
```

```json [package.json]
{
  "type": "module",
  "scripts": {
    "dev": "nitro dev",
    "build": "nitro build",
    "preview": "node .output/server/index.mjs"
  },
  "devDependencies": {
    "nitro": "latest",
    "takumi-js": "latest"
  }
}
```

```json [tsconfig.json]
{
  "extends": "nitro/tsconfig"
}
```

```ts [vite.config.ts]
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [nitro()],
});
```

```ts [routes/og.png.ts]
import { defineHandler } from "nitro";
import { container, text } from "takumi-js/helpers";
import ImageResponse from "takumi-js/response";

export default defineHandler(async ({ url }) => {
  const title = url.searchParams.get("title") ?? "Takumi + Nitro";
  const description = url.searchParams.get("description") ?? "Render OG images from a Nitro route.";

  const start = performance.now();

  const response = new ImageResponse(
    container({
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "64px",
        backgroundImage: "linear-gradient(to bottom right, #fff1f2, #fecdd3)",
      },
      children: [
        text(title, { fontSize: 72, fontWeight: 700, color: "#111827" }),
        text(description, { fontSize: 42, fontWeight: 500, color: "#4b5563" }),
      ],
    }),
    { width: 1200, height: 630 }
  );

  await response.ready;
  response.headers.set("Server-Timing", `render;dur=${(performance.now() - start).toFixed(1)}`);

  return response;
});
```

::

<!-- /automd -->

<!-- automd:file src="../../examples/takumi/README.md" -->

Generate dynamic [Open Graph](https://ogp.me/) images from a Nitro route using [Takumi](https://takumi.kane.tw). The `index.html` page references the generated image through its `og:image` meta tag and previews it live.

## Server Route

Build the node tree with Takumi [helpers](https://takumi.kane.tw/docs/helpers) — no JSX setup needed. Nitro handlers can return a `Response`, so return an `ImageResponse` directly. The handler awaits `response.ready` and adds a `Server-Timing` header so callers can see how long the render took:

```ts [routes/og.png.ts]
import { defineHandler } from "nitro";
import { container, text } from "takumi-js/helpers";
import ImageResponse from "takumi-js/response";

export default defineHandler(async ({ url }) => {
  const title = url.searchParams.get("title") ?? "Takumi + Nitro";
  const description =
    url.searchParams.get("description") ?? "Render OG images from a Nitro route.";

  const start = performance.now();

  const response = new ImageResponse(
    container({
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "64px",
        backgroundImage: "linear-gradient(to bottom right, #fff1f2, #fecdd3)",
      },
      children: [
        text(title, { fontSize: 72, fontWeight: 700, color: "#111827" }),
        text(description, { fontSize: 42, fontWeight: 500, color: "#4b5563" }),
      ],
    }),
    { width: 1200, height: 630 },
  );

  await response.ready;
  response.headers.set("Server-Timing", `render;dur=${(performance.now() - start).toFixed(1)}`);

  return response;
});
```

## Referencing the Image

The `index.html` points its Open Graph tags at the route so crawlers get a freshly rendered preview:

```html [index.html]
<meta property="og:image" content="/og.png?title=Takumi%20%2B%20Nitro" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
```

## Request the Endpoint

Visit `/og.png?title=Hello&description=From%20Nitro` to render an image with custom text. The response includes a `Server-Timing` header reporting the render duration; the demo page re-fetches the image as you type in the title/description fields and shows a "Generating…" / "N ms" badge overlaid in the bottom-right corner of the preview. The link icon next to the title always points at the raw endpoint for the current preview.

The `index.html` head preloads the initial image so the browser starts fetching it in parallel with parsing, and the `<img>` reserves its `1200x630` aspect ratio via width/height attributes and CSS to avoid layout shift while it loads.

Takumi picks the render backend from the deployment target: native bindings on the Node preset, WebAssembly on edge presets. No config is needed.

<!-- /automd -->

## Learn More

- [Takumi](https://takumi.kane.tw)
