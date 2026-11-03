This example renders an HTML template on the server with [Rsbuild](https://rsbuild.rs) and the experimental `nitro/rsbuild` plugin, without a framework.

## Overview

1. **Add the Nitro Rsbuild plugin** to your Rsbuild config
2. **Create an HTML template** with a `<!--ssr-outlet-->` comment where server content goes
3. **Create a server entry** (`app/entry-server.ts`) that renders the page content
4. **Create a client entry** (`app/entry-client.ts`) that makes the page interactive
5. **Add API routes** for server-side data

## How It Works

Nitro detects `app/entry-server.ts` and adds an `ssr` environment to the Rsbuild app. The server entry exports an object with a `fetch` method, which calls the `/api/hello` route with Nitro's internal fetch and returns the HTML of the page.

The `index.html` template is the Rsbuild HTML template of the client: Rsbuild injects the client scripts, and Nitro renders the `<!--ssr-outlet-->` comment with the server entry for each page request.

Run `rsbuild dev` for development, and `rsbuild build` to build the client and the server into `.output/`.
