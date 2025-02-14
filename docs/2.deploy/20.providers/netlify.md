# Netlify

> Deploy Nitro apps to Netlify functions or edge.

**Preset:** `netlify`

:read-more{title="Netlify Functions" to="https://www.netlify.com/platform/core/functions/"}

::note
Integration with this provider is possible with [zero configuration](/deploy/#zero-config-providers).
::

Normally, the deployment to Netlify does not require any configuration.
Nitro will auto-detect that you are in a [Netlify](https://www.netlify.com) build environment and build the correct version of your server.

For new sites, Netlify will detect that you are using Nitro and set the publish directory to `dist` and build command to `npm run build`.

If you are upgrading an existing site you should check these and update them if needed.

If you want to add custom redirects, you can do so with [`routeRules`](/config#routerules) or by adding a [`_redirects`](https://docs.netlify.com/routing/redirects/#syntax-for-the-redirects-file) file to your `public` directory.

For deployment, just push to your git repository [as you would normally do for Netlify](https://docs.netlify.com/configure-builds/get-started/).

::note{type="note"}
Make sure the publish directory is set to `dist` when creating a new project.
::

## Netlify edge functions

**Preset:** `netlify_edge`

Netlify Edge Functions use Deno and the powerful V8 JavaScript runtime to let you run globally distributed functions for the fastest possible response times.

:read-more{title="Netlify Edge functions" to="https://docs.netlify.com/edge-functions/overview/"}

Nitro output can directly run the server at the edge. Closer to your users.

::note{type="note"}
Make sure the publish directory is set to `dist` when creating a new project.
::

## On-demand builders

**Preset:** `netlify_builder`

::warning
**Note:** This preset is deprecated. Instead, use the `netlify` preset with the `isr` route rule.
::

On-demand Builders are serverless functions used to generate web content as needed that’s automatically cached on Netlify’s Edge CDN. They enable you to build pages for your site when a user visits them for the first time and then cache them at the edge for subsequent visits.

:read-more{title="Netlify On-demand Builders" to="https://docs.netlify.com/configure-builds/on-demand-builders/"}

## Custom deploy configuration

You can provide additional deploy configuration using the `netlify` key inside `nitro.config`. It will be merged with built-in auto-generated config. Currently the only supported value is `images.remote_images`, for [configuring Netlify Image CDN](https://docs.netlify.com/image-cdn/create-integration/).
