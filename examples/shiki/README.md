---
category: integrations
icon: i-lucide-highlighter
defaultFile: api/highlight.ts
---

# Shiki

> Server-side syntax highlighting in Nitro with Shiki.

Use Shiki for syntax highlighting with TextMate grammars. This example highlights code on the server using Nitro's server scripts feature, which runs JavaScript inside HTML files before sending the response.

<!-- automd:dir-tree -->

```
├── api/
│   └── highlight.ts
├── index.html
├── nitro.config.ts
├── package.json
├── README.md
├── styles.css
├── tsconfig.json
└── vite.config.ts
```

<!-- /automd -->

## API Route

<!-- automd:file src="api/highlight.ts" code -->

```ts [highlight.ts]
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

<!-- /automd -->

Create a Shiki highlighter with the Vitesse Dark theme and TypeScript language support. When the API receives a POST request, it reads the code from the request body and returns highlighted HTML.

## Server-Side Rendering

<!-- automd:file src="index.html" code lang="html" -->

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

<!-- /automd -->

The `<script server>` tag runs on the server before the HTML is sent. It defines a helper function that calls the highlight API using `serverFetch`. The triple-brace syntax `{{{ }}}` outputs the result without escaping, so the highlighted HTML renders correctly.

## Learn More

- [Shiki](https://shiki.style/)
