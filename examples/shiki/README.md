---
category: integrations
icon: i-lucide-highlighter
---

# Shiki

> Server-side syntax highlighting in Nitro with Shiki.

<!-- automd:ui-code-tree src="." default="api/highlight.ts" ignore="README.md,GUIDE.md" expandAll -->

::code-tree{defaultValue="api/highlight.ts" expandAll}

```html [index.html]
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Hello World Snippet</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <div class="card" role="region" aria-label="Code snippet">
      <div class="label">JavaScript</div>
      <script server>
        const hl = (code) =>
          serverFetch("/api/highlight", {
            method: "POST",
            body: code,
          });
      </script>
      <pre><code>{{{ hl(`console.log("💚 Simple is beautiful!");`) }}}</code></pre>
    </div>
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
    "dev": "vite dev",
    "build": "vite build"
  },
  "devDependencies": {
    "nitro": "latest",
    "shiki": "^3.21.0"
  }
}
```

```css [styles.css]
html,
body {
  height: 100%;
  margin: 0;
}
body {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f6f8fa;
  font-family:
    system-ui,
    -apple-system,
    "Segoe UI",
    Roboto,
    "Helvetica Neue",
    Arial,
    "Noto Sans",
    "Liberation Sans",
    sans-serif;
}
.card {
  text-align: left;
  background: #0b1220;
  color: #e6edf3;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(2, 6, 23, 0.2);
  max-width: 90%;
  width: 520px;
}
.label {
  font-size: 12px;
  color: #9aa7b2;
  margin-bottom: 8px;
}
pre {
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, "Courier New", monospace;
  font-size: 14px;
  background: transparent;
  white-space: pre;
  overflow: auto;
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

```ts [api/highlight.ts]
import { createHighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";

const highlighter = await createHighlighterCore({
  engine: createOnigurumaEngine(import("shiki/wasm")),
  themes: [await import("shiki/themes/vitesse-dark.mjs")],
  langs: [await import("shiki/langs/ts.mjs")],
});

export default async ({ req }: { req: Request }) => {
  const code = await req.text();
  const html = await highlighter.codeToHtml(code, {
    lang: "ts",
    theme: "vitesse-dark",
  });
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
};
```

::

<!-- /automd -->

<!-- automd:file src="GUIDE.md" -->

Use Shiki for syntax highlighting with TextMate grammars. This example highlights code on the server using Nitro's server scripts feature, which runs JavaScript inside HTML files before sending the response.

## API Route

```ts [api/highlight.ts]
import { createHighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";

const highlighter = await createHighlighterCore({
  engine: createOnigurumaEngine(import("shiki/wasm")),
  themes: [await import("shiki/themes/vitesse-dark.mjs")],
  langs: [await import("shiki/langs/ts.mjs")],
});

export default async ({ req }: { req: Request }) => {
  const code = await req.text();
  const html = await highlighter.codeToHtml(code, {
    lang: "ts",
    theme: "vitesse-dark",
  });
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
};
```

Create a Shiki highlighter with the Vitesse Dark theme and TypeScript language support. When the API receives a POST request, it reads the code from the request body and returns highlighted HTML.

## Server-Side Rendering

```html [index.html]
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Hello World Snippet</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <div class="card" role="region" aria-label="Code snippet">
      <div class="label">JavaScript</div>
      <script server>
        const hl = (code) =>
          serverFetch("/api/highlight", {
            method: "POST",
            body: code,
          });
      </script>
      <pre><code>{{{ hl(`console.log("💚 Simple is beautiful!");`) }}}</code></pre>
    </div>
  </body>
</html>
```

The `<script server>` tag runs on the server before the HTML is sent. It defines a helper function that calls the highlight API using `serverFetch`. The triple-brace syntax `{{{ }}}` outputs the result without escaping, so the highlighted HTML renders correctly.

<!-- /automd -->

## Learn More

- [Shiki](https://shiki.style/)
