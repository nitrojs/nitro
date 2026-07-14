# Netlify

> Deploy Nitro apps to Netlify functions or edge.

**Preset:** `netlify`

:read-more{title="Netlify Functions" to="https://www.netlify.com/platform/core/functions/"}

::note
Integration with this provider is possible with [zero configuration](/deploy/#zero-config-providers).
::

Normally, deploying to Netlify does not require any configuration.
Nitro auto-detects that you are in a [Netlify](https://www.netlify.com) build environment and builds the correct version of your server.

For new sites, Netlify detects that you are using Nitro and sets the publish directory to `dist` and the build command to `npm run build`. If you are upgrading an existing site, check these settings and update them if needed.

To add custom redirects, use [`routeRules`](/config#routerules) or add a [`_redirects`](https://docs.netlify.com/routing/redirects/#syntax-for-the-redirects-file) file to your `public` directory.

To deploy, just push to your git repository [as you would normally do for Netlify](https://docs.netlify.com/configure-builds/get-started/).

::note
Make sure the publish directory is set to `dist` when creating a new project.
::

## Netlify edge functions

**Preset:** `netlify_edge`

Netlify Edge Functions use Deno and the powerful V8 JavaScript runtime to let you run globally distributed functions for the fastest possible response times.

:read-more{title="Netlify Edge functions" to="https://docs.netlify.com/edge-functions/overview/"}

With this preset, Nitro runs the server directly at the edge, closer to your users.

::note
Make sure the publish directory is set to `dist` when creating a new project.
::

## Netlify static

**Preset:** `netlify_static`

Use the `netlify_static` preset to pre-render your app and deploy it to Netlify as a fully static site (no functions).

## Custom deploy configuration

You can provide additional deploy configuration using the `netlify.config` key inside `nitro.config`. It follows the [Netlify Frameworks API](https://docs.netlify.com/build/frameworks/frameworks-api/) `config.json` format and will be merged with the built-in auto-generated configuration.

```ts [nitro.config.ts]
import { defineConfig } from "nitro";

export default defineConfig({
  netlify: {
    config: {
      // Netlify Image CDN remote images
      images: {
        remote_images: ["https://example.com/.*"],
      },
      // Custom headers
      headers: [{ for: "/static/*", values: { "cache-control": "public, max-age=31536000" } }],
      // Custom redirects
      redirects: [{ from: "/old", to: "/new", status: 301 }],
    },
  },
});
```

Supported keys:

- `edge_functions`: Additional [edge function declarations](https://docs.netlify.com/edge-functions/declarations/).
- `functions`: [Functions configuration](https://docs.netlify.com/build/frameworks/frameworks-api/#functions), either global or by function pattern (e.g., `included_files`).
- `headers`: Custom [header rules](https://docs.netlify.com/routing/headers/).
- `images`: [Netlify Image CDN](https://docs.netlify.com/image-cdn/create-integration/) configuration (e.g., `remote_images`).
- `redirects`: Custom [redirect rules](https://docs.netlify.com/routing/redirects/).

::note
The top-level `netlify.images` option is deprecated. Use `netlify.config.images` instead.
::
