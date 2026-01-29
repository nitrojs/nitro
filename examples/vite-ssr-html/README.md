---
category: server side rendering
icon: i-logos-html-5
defaultFile: app/entry-server.ts
---

# Vite SSR HTML

> Server-side rendering with vanilla HTML, Vite, and Nitro.

This example renders an HTML template with server-side data and streams the response word by word. It demonstrates how to use Nitro's Vite SSR integration without a framework.

<!-- automd:dir-tree -->

```
├── app/
│   └── entry-server.ts
├── routes/
│   └── quote.ts
├── server/
│   └── routes/
├── index.html
├── package.json
├── README.md
├── tsconfig.json
└── vite.config.ts
```

<!-- /automd -->

## Overview

1. **Add the Nitro Vite plugin** to enable SSR
2. **Create an HTML template** with a `<!--ssr-outlet-->` comment where server content goes
3. **Create a server entry** that fetches data and returns a stream
4. **Add API routes** for server-side data

## 1. HTML Template

The `index.html` file contains an `<!--ssr-outlet-->` comment that marks where server-rendered content will be inserted:

```html
<div id="quote">
  <!--ssr-outlet-->
</div>
```

Nitro replaces this comment with the output from your server entry.

## 2. Server Entry

<!-- automd:file src="app/entry-server.ts" code -->

```ts [entry-server.ts]
import { fetch } from "nitro";

export default {
  async fetch() {
    const quote = (await fetch("/quote").then((res) => res.json())) as {
      text: string;
    };
    return tokenizedStream(quote.text, 50);
  },
};

function tokenizedStream(text: string, delay: number): ReadableStream<Uint8Array> {
  const tokens = text.split(" ");
  return new ReadableStream({
    start(controller) {
      let index = 0;
      function push() {
        if (index < tokens.length) {
          const word = tokens[index++] + (index < tokens.length ? " " : "");
          controller.enqueue(new TextEncoder().encode(word));
          setTimeout(push, delay);
        } else {
          controller.close();
        }
      }
      push();
    },
  });
}
```

<!-- /automd -->

The server entry exports an object with a `fetch` method. It calls the `/quote` API route using Nitro's internal fetch, then returns a `ReadableStream` that emits the quote text word by word with a 50ms delay between each word.

## 3. API Route

<!-- automd:file src="routes/quote.ts" code -->

```ts [quote.ts]
const QUOTES_URL =
  "https://github.com/JamesFT/Database-Quotes-JSON/raw/refs/heads/master/quotes.json";

let _quotes: Promise<unknown> | undefined;

function getQuotes() {
  return (_quotes ??= fetch(QUOTES_URL).then((res) => res.json())) as Promise<
    { quoteText: string; quoteAuthor: string }[]
  >;
}

export default async function quotesHandler() {
  const quotes = await getQuotes();
  const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
  return Response.json({
    text: randomQuote.quoteText,
    author: randomQuote.quoteAuthor,
  });
}
```

<!-- /automd -->

The quote route fetches a JSON file of quotes from GitHub, caches the result, and returns a random quote. The server entry calls this route to get content for the page.

## Learn More

- [Renderer](/docs/renderer)
- [Server Entry](/docs/server-entry)
