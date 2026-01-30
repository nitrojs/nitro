---
category: server side rendering
icon: i-logos-html-5
---

# Vite SSR HTML

> Server-side rendering with vanilla HTML, Vite, and Nitro.


<!-- automd:ui-code-tree src="." default="app/entry-server.ts" ignore="README.md" expandAll -->

::code-tree{defaultValue="app/entry-server.ts" expandAll}

```html [index.html]
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Nitro Quotes</title>
    <style>
      @import "tailwindcss";
    </style>
  </head>
  <body
    class="min-h-screen flex items-center justify-center p-5 bg-gradient-to-br from-indigo-500 to-purple-600 font-sans"
  >
    <div class="max-w-xl w-full text-center text-white">
      <div class="bg-white/10 backdrop-blur-md rounded-2xl p-10 shadow-xl border border-white/20">
        <div
          id="quote"
          class="text-[clamp(1.2rem,4vw,1.8rem)] leading-relaxed mb-5 font-light opacity-70 transition-opacity duration-500"
        >
          <!--ssr-outlet-->
        </div>
        <div
          id="author"
          class="text-[clamp(1rem,3vw,1.2rem)] opacity-0 font-normal transition-opacity duration-500"
        ></div>
        <button
          id="refresh-btn"
          class="mt-5 bg-white/20 border border-white/30 text-white px-6 py-3 rounded-full cursor-pointer text-sm transition hover:bg-white/30 hover:-translate-y-0.5"
          onclick="fetchQuote()"
        >
          New Quote
        </button>
      </div>
      <div class="mt-8 text-sm opacity-60">
        Powered by
        <a
          class="text-white no-underline border-b border-white/30 hover:border-white transition-colors"
          href="https://vitejs.dev/"
          >Vite</a
        >
        and
        <a
          class="text-white no-underline border-b border-white/30 hover:border-white transition-colors"
          href="https://github.com/nitrojs/nitro"
          >Nitro v3</a
        >.
      </div>
    </div>

    <script>
      const quoteElement = document.getElementById("quote");
      const authorElement = document.getElementById("author");
      const refreshBtn = document.getElementById("refresh-btn");

      const baseQuoteClasses =
        "text-[clamp(1.2rem,4vw,1.8rem)] leading-relaxed mb-5 font-light transition-opacity duration-500";
      const loadingQuoteClasses = baseQuoteClasses + " opacity-70";
      const normalQuoteClasses = baseQuoteClasses + " opacity-100";
      const errorQuoteClasses = baseQuoteClasses + " text-red-400 opacity-100 text-sm";

      const baseAuthorClasses =
        "text-[clamp(1rem,3vw,1.2rem)] font-normal transition-opacity duration-500";
      const hiddenAuthorClasses = baseAuthorClasses + " opacity-0";
      const visibleAuthorClasses = baseAuthorClasses + " opacity-80";

      async function fetchQuote() {
        try {
          quoteElement.textContent = "Loading...";
          quoteElement.className = loadingQuoteClasses;
          authorElement.textContent = "";
          authorElement.className = hiddenAuthorClasses;
          refreshBtn.style.display = "none";
          const response = await fetch("/quote");
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const { text, author } = await response.json();
          quoteElement.textContent = `"${text}"`;
          quoteElement.className = normalQuoteClasses;
          authorElement.textContent = `— ${author}`;
          authorElement.className = visibleAuthorClasses;
        } catch (error) {
          console.error("Error fetching quote:", error);
          quoteElement.textContent = "Failed to load quote. Please try again.";
          quoteElement.className = errorQuoteClasses;
          authorElement.textContent = "";
          authorElement.className = hiddenAuthorClasses;
        } finally {
          refreshBtn.style.display = "inline-block";
        }
      }
    </script>
  </body>
</html>
```

```json [package.json]
{
  "type": "module",
  "scripts": {
    "build": "vite build",
    "dev": "vite dev",
    "preview": "vite preview"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.18",
    "nitro": "latest",
    "tailwindcss": "^4.1.18",
    "vite": "beta"
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

import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    nitro({
      serverDir: "./",
    }),
    tailwindcss(),
  ],
});
```

```ts [app/entry-server.ts]
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

```ts [routes/quote.ts]
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

::

<!-- /automd -->

This example renders an HTML template with server-side data and streams the response word by word. It demonstrates how to use Nitro's Vite SSR integration without a framework.

## Overview

1. **Add the Nitro Vite plugin** to enable SSR
2. **Create an HTML template** with a `<!--ssr-outlet-->` comment where server content goes
3. **Create a server entry** that fetches data and returns a stream
4. **Add API routes** for server-side data

## How It Works

The `index.html` file contains an `<!--ssr-outlet-->` comment that marks where server-rendered content will be inserted. Nitro replaces this comment with the output from your server entry.

The server entry exports an object with a `fetch` method. It calls the `/quote` API route using Nitro's internal fetch, then returns a `ReadableStream` that emits the quote text word by word with a 50ms delay between each word.

The quote route fetches a JSON file of quotes from GitHub, caches the result, and returns a random quote. The server entry calls this route to get content for the page.

## Learn More

- [Renderer](/docs/renderer)
- [Server Entry](/docs/server-entry)
