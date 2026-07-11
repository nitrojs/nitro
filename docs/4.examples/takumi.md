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
      img.preview {
        display: block;
        width: 100%;
        height: auto;
        border-radius: 12px;
        border: 1px solid rgba(0, 0, 0, 0.08);
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
      <h1>Takumi + Nitro</h1>
      <p class="lead">
        The image below is generated at request time by the
        <code>routes/og.png.ts</code> handler.
      </p>

      <img
        id="preview"
        class="preview"
        alt="Generated Open Graph image"
        src="/og.png?title=Takumi%20%2B%20Nitro&description=Render%20OG%20images%20from%20a%20Nitro%20route."
      />

      <div class="controls">
        <input id="title" placeholder="Title" value="Takumi + Nitro" />
        <input
          id="description"
          placeholder="Description"
          value="Render OG images from a Nitro route."
        />
        <button id="generate">Generate</button>
      </div>
      <p class="lead">
        Endpoint:
        <code>/og.png?title=Hello&amp;description=From%20Nitro</code>
      </p>
    </main>

    <script>
      const preview = document.getElementById("preview");
      const titleInput = document.getElementById("title");
      const descInput = document.getElementById("description");

      document.getElementById("generate").addEventListener("click", () => {
        const params = new URLSearchParams({
          title: titleInput.value,
          description: descInput.value,
        });
        preview.src = `/og.png?${params.toString()}`;
      });
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

```ts [routes/og.png.ts]
import { defineHandler } from "nitro";
import { container, text } from "takumi-js/helpers";
import ImageResponse from "takumi-js/response";

export default defineHandler((event) => {
  const url = new URL(event.req.url);
  const title = url.searchParams.get("title") ?? "Takumi + Nitro";
  const description = url.searchParams.get("description") ?? "Render OG images from a Nitro route.";

  return new ImageResponse(
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
    {
      width: 1200,
      height: 630,
    }
  );
});
```

::

<!-- /automd -->

<!-- automd:file src="../../examples/takumi/README.md" -->

Generate dynamic [Open Graph](https://ogp.me/) images from a Nitro route using [Takumi](https://takumi.kane.tw). The `index.html` page references the generated image through its `og:image` meta tag and previews it live.

## Server Route

Build the node tree with Takumi [helpers](https://takumi.kane.tw/docs/helpers) — no JSX setup needed. Nitro handlers can return a `Response`, so return an `ImageResponse` directly:

```ts [routes/og.png.ts]
import { defineHandler } from "nitro";
import { container, text } from "takumi-js/helpers";
import ImageResponse from "takumi-js/response";

export default defineHandler((event) => {
  const url = new URL(event.req.url);
  const title = url.searchParams.get("title") ?? "Takumi + Nitro";
  const description =
    url.searchParams.get("description") ?? "Render OG images from a Nitro route.";

  return new ImageResponse(
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

Visit `/og.png?title=Hello&description=From%20Nitro` to render an image with custom text.

Takumi picks the render backend from the deployment target: native bindings on the Node preset, WebAssembly on edge presets. No config is needed.

<!-- /automd -->

## Learn More

- [Takumi](https://takumi.kane.tw)
