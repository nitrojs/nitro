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
