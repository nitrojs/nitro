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
