# Cloudflare

> Deploy Nitro apps to Cloudflare.

## Cloudflare Workers

**Preset:** `cloudflare_module`

:read-more{title="Cloudflare Workers" to="https://developers.cloudflare.com/workers/"}

::note
Integration with this provider is possible with [zero configuration](/deploy#zero-config-providers) supporting [workers builds (beta)](https://developers.cloudflare.com/workers/ci-cd/builds/).
::

::important
To use Workers with Static Assets, you need a Nitro compatibility date set to `2024-09-19` or later.
::

The following shows an example `nitro.config.ts` file for deploying a Nitro app to Cloudflare Workers.

::code-group

```ts [nitro.config.ts]
export default defineNitroConfig({
    compatibilityDate: "2024-09-19",
    preset: "cloudflare_module",
    cloudflare: {
      deployConfig: true,
      nodeCompat: true
    }
})
```

```ts [nuxt.config.ts]
export default defineNuxtConfig({
    compatibilityDate: "2024-09-19",
    nitro: {
      preset: "cloudflare_module",
      cloudflare: {
        deployConfig: true,
        nodeCompat: true
      }
    }
})
```
::

By setting `deployConfig: true`, Nitro will automatically generate a `wrangler.json` for you with the correct configuration.
If you need to add [Cloudflare Workers configuration](https://developers.cloudflare.com/workers/wrangler/configuration/), such as [bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/), you can either:

- Set these in your Nitro config under the `cloudflare: { wrangler : {} }`. This has the same type as `wrangler.json`.
- Provide your own `wrangler.json`. Nitro will merge your config with the appropriate settings, including pointing to the build output.

### Local Preview

You can use [Wrangler](https://github.com/cloudflare/workers-sdk/tree/main/packages/wrangler) to preview your app locally:

:pm-run{script="build"}

:pm-x{command="wrangler dev"}

### Manual Deploy

After having built your application you can manually deploy it with Wrangler.

First make sure to be logged into your Cloudflare account:

:pm-x{command="wrangler login"}

Then you can deploy the application with:

:pm-x{command="wrangler deploy"}

### Runtime Hooks

You can use [runtime hooks](/guide/plugins#nitro-runtime-hooks) below in order to extend [Worker handlers](https://developers.cloudflare.com/workers/runtime-apis/handlers/).

:read-more{to="/guide/plugins#nitro-runtime-hooks"}

- [`cloudflare:scheduled`](https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/)
- [`cloudflare:email`](https://developers.cloudflare.com/email-routing/email-workers/runtime-api/)
- [`cloudflare:queue`](https://developers.cloudflare.com/queues/configuration/javascript-apis/#consumer)
- [`cloudflare:tail`](https://developers.cloudflare.com/workers/runtime-apis/handlers/tail/)
- `cloudflare:trace`


## Cloudflare Pages

**Preset:** `cloudflare_pages`

:read-more{title="Cloudflare Pages" to="https://pages.cloudflare.com/"}

::note
Integration with this provider is possible with [zero configuration](/deploy#zero-config-providers).
::

::warning
Cloudflare [Workers Module](#cloudflare-workers) is the new recommended preset for deployments. Please consider using the pages only if you need specific features.
::

The following shows an example `nitro.config.ts` file for deploying a Nitro app to Cloudflare Pages.

::code-group

```ts [nitro.config.ts]
export default defineNitroConfig({
    preset: "cloudflare_pages",
    cloudflare: {
      deployConfig: true,
      nodeCompat:true
    }
})
```

```ts [nuxt.config.ts]
export default defineNuxtConfig({
    nitro: {
      preset: "cloudflare_pages",
      cloudflare: {
        deployConfig: true,
        nodeCompat:true
      }
    }
})
```
::

Nitro automatically generates a `_routes.json` file that controls which routes get served from files and which are served from the Worker script. The auto-generated routes file can be overridden with the config option `cloudflare.pages.routes` ([read more](https://developers.cloudflare.com/pages/platform/functions/routing/#functions-invocation-routes)).

### Local Preview

You can use [Wrangler](https://github.com/cloudflare/workers-sdk/tree/main/packages/wrangler) to preview your app locally:

:pm-run{script="build"}

:pm-x{command="wrangler pages dev"}

### Manual Deploy

After having built your application you can manually deploy it with Wrangler, in order to do so first make sure to be
logged into your Cloudflare account:

:pm-x{command="wrangler login"}

Then you can deploy the application with:

:pm-x{command="wrangler pages deploy"}

## Cloudflare Service Workers

**Preset:** `cloudflare`

::note
**Note:** This preset uses the [service worker syntax](https://developers.cloudflare.com/workers/learning/service-worker/) for deployment.
::

::warning
**Note:** This preset is deprecated.
::

The way this preset works is identical to that of the `cloudflare_module` one presented above, with the only difference being that such preset inherits all the [disadvantages](https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/#advantages-of-migrating) that such syntax brings.

## Deploy within CI/CD using GitHub Actions

Regardless on whether you're using Cloudflare Pages or Cloudflare Workers, you can use the [Wrangler GitHub actions](https://github.com/marketplace/actions/deploy-to-cloudflare-workers-with-wrangler) to deploy your application.

::note
**Note:** Remember to [instruct Nitro to use the correct preset](/deploy#changing-the-deployment-preset) (note that this is necessary for all presets including the `cloudflare_pages` one).
::

## Environment Variables

Nitro allows you to universally access environment variables using `process.env` or `import.meta.env` or the runtime config.

::note
Make sure to only access environment variables **within the event lifecycle**  and not in global contexts since Cloudflare only makes them available during the request lifecycle and not before.
::

**Example:** If you have set the `SECRET` and `NITRO_HELLO_THERE` environment variables set you can access them in the following way:

```ts
console.log(process.env.SECRET) // note that this is in the global scope! so it doesn't actually work and the variable is undefined!

export default defineEventHandler((event) => {
  // note that all the below are valid ways of accessing the above mentioned variables
  useRuntimeConfig(event).helloThere
  useRuntimeConfig(event).secret
  process.env.NITRO_HELLO_THERE
  import.meta.env.SECRET
});
```

### Specify Variables in Development Mode

For development, you can use a `.env` file to specify environment variables:

```ini
NITRO_HELLO_THERE="captain"
SECRET="top-secret"
```

::note
**Note:** Make sure you add `.env` to the `.gitignore` file so that you don't commit it as it can contain sensitive information.
::

### Specify Variables for local previews

After build, when you try out your project locally with `wrangler dev` or `wrangler pages dev`, in order to have access to environment variables you will need to specify the in a `.dev.vars` file in the root of your project (as presented in the [Pages](https://developers.cloudflare.com/pages/functions/bindings/#interact-with-your-environment-variables-locally) and [Workers](https://developers.cloudflare.com/workers/configuration/environment-variables/#interact-with-environment-variables-locally) documentation).

If you are using a `.env` file while developing, your `.dev.vars` should be identical to it.

::note
**Note:** Make sure you add `.dev.vars` to the `.gitignore` file so that you don't commit it as it can contain sensitive information.
::

### Specify Variables for Production

For production, use the Cloudflare dashboard or the [`wrangler secret`](https://developers.cloudflare.com/workers/wrangler/commands/#secret) command to set environment variables and secrets.

### Specify Variables using `wrangler.toml`/`wrangler.json`

You can specify a custom `wrangler.toml`/`wrangler.json` file and define vars inside.

::warning
Note that this isn't recommend for sensitive data like secrets.
::

**Example:**

```ini [wrangler.toml]
# Shared
[vars]
NITRO_HELLO_THERE="general"
SECRET="secret"

# Override values for `--env production` usage
[env.production.vars]
NITRO_HELLO_THERE="captain"
SECRET="top-secret"
```

## Direct access to Cloudflare bindings

Bindings are what allows you to interact with resources from the Cloudflare platform, examples of such resources are key-value data storages ([KVs](https://developers.cloudflare.com/kv/)) and serverless SQL databases ([D1s](https://developers.cloudflare.com/d1/)).

::read-more
For more details on Bindings and how to use them please refer to the Cloudflare [Pages](https://developers.cloudflare.com/pages/functions/bindings/) and [Workers](https://developers.cloudflare.com/workers/configuration/bindings/#bindings) documentation.
::

> [!TIP]
> Nitro provides high level API to interact with primitives such as [KV Storage](/guide/storage) and [Database](/guide/database) and you are highly recommended to prefer using them instead of directly depending on low-level APIs for usage stability.

:read-more{title="Database Layer" to="/guide/database"}

:read-more{title="KV Storage" to="/guide/storage"}

In runtime, you can access bindings from the request event, by accessing its `context.cloudflare.env` field, this is for example how you can access a D1 bindings:

```ts
defineEventHandler(async (event) => {
  const { cloudflare } = event.context
  const stmt = await cloudflare.env.MY_D1.prepare('SELECT id FROM table')
  const { results } = await stmt.all()
})
```

## Dev Preset

Cloudflare preset can be enabled in development mode for production environment emulation and access to the bindings in local dev.

In order to enable dev preset, make sure using latest nitro version (>=2.12) and install [`wrangler`](https://npmjs.com/package/wrangler) as a dependency.

:pm-install{name="-D wrangler"}

Then, update config:

```ts [nitro.config.ts]
export default defineNitroConfig({
    compatibilityDate: "2025-07-15", // or "latest"
    preset: "cloudflare-module" // or "cloudflare-pages"
})
```

```ts [nuxt.config.ts]
export default defineNuxtConfig({
    compatibilityDate: "2025-07-15", // or "latest"
    nitro: {
        preset: "cloudflare-module" // or "cloudflare-pages"
    }
})
```

In development terminal, you should see a message like this:

```sh
ℹ Using cloudflare-dev emulation in development mode.
```

In order to access bindings in dev mode we start by defining the bindings. You can do this in a `wrangler.toml`/`wrangler.jsonc` file, or directly in your Nitro config under `cloudflare.wrangler` (accepts the same type as `wrangler.json`).

For example to define a variable and a KV namespace in a `wrangler.toml`

```ini [wrangler.toml]
[vars]
MY_VARIABLE="my-value"

[[kv_namespaces]]
binding = "MY_KV"
id = "xxx"
```

Or in your Nitro config:

```js [nitro.config.js]
export default defineNitroConfig({
    cloudflare: {
      wrangler: {
        vars: {
          MY_VARIABLE: "my-value"
        },
        kv_namespaces: [
          {
            binding: "MY_KV",
            id: "xxx"
          }
        ]
      }
    }
});
```

> [!NOTE]
> Only bindings in the default environment are recognized.

you will be able to access the `MY_VARIABLE` and `MY_KV` from the request event just as illustrated above.

## Tree-shaking and third-party libraries

At build time, Nitro will search-and-replace certain strings in the source code of the application and libraries.  The full list is available in [Nitro's Rollup config](https://github.com/nitrojs/nitro/blob/v2/src/rollup/config.ts).  Making the replacements allows Rollup to tree-shake dependencies and prune code branches that may be client-only or server-only.  However, in certain cases the replacements may cause syntax errors during the build step.

One example (described in more detail [here](https://github.com/nitrojs/nitro/issues/3071)):

- A third-party library contains embedded source code of the form:
  ```ts
  const source = "if (typeof window === 'undefined') ...";
  ```
- Nitro replaces the literal string `typeof window` with `"undefined"`, resulting in:
  ```ts
  const source = "if ("undefined" === 'undefined') ...";`
  ```
- The improperly nested double quotes result in a build error:
  ```
  Expected ',', got 'undefined'
  ```

To work around issues like this, it's possible to override Nitro's search-and-replace config.  For example, adding this to your Nitro options may fix the issue by providing a different type of quoting:

```
replace: {
  'typeof window': '`undefined`',
}
```

Or in Nuxt:

```
nitro: {
  replace: {
    'typeof window': '`undefined`',
  },
}
```
