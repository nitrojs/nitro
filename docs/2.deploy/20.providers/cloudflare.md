# Cloudflare

> Deploy Nitro apps to Cloudflare.

## Cloudflare Pages

**Preset:** `cloudflare_pages`

:read-more{title="Cloudflare Pages" to="https://pages.cloudflare.com/"}

::note
This is the recommended preset for Cloudflare deployments, please consider using the alternative ones if you need special features.
::

::note
Integration with this provider is possible with [zero configuration](/deploy#zero-config-providers).
::

Nitro automatically generates a `_routes.json` file that controls which routes get served from files and which are served from the Worker script. The auto-generated routes file can be overridden with the config option `cloudflare.pages.routes` ([read more](https://developers.cloudflare.com/pages/platform/functions/routing/#functions-invocation-routes)).

### Building your Application using the preset

The preset only applies for the application build process.

If you use the [Cloudflare Pages GitHub/GitLab integration](https://developers.cloudflare.com/pages/get-started/#connect-your-git-provider-to-pages), and you don't need to preview your application locally, Nitro does not require any type of configuration. When you push to your repository, the Cloudflare Pages CI/CD process will automatically build your project and Nitro will detect the correct environment and build your application accordingly.

If instead you want preview your application locally and/or manually deploy it, when building the application you will need to let Nitro know that the target environment is the Cloudflare Pages one, you can do that in two ways:

- By defining either the `NITRO_PRESET` or the `SERVER_PRESET` environment variable set to `cloudflare_pages` when running the build process, like so:

    ```bash
    NITRO_PRESET=cloudflare_pages npm run build
    ```

- Or by updating your Nitro [preset configuration](/config#preset):

    ```json5
    "preset": "cloudflare_pages",
    ```

    and then running the standard build command:

    :pm-run{script="build"}

### Wrangler

To preview your application locally or manually deploy it you will need to use the [wrangler](https://github.com/cloudflare/workers-sdk/tree/main/packages/wrangler) CLI tool, simply install it as a node dependency:

:pm-install{name="wrangler"}

### Preview your app locally

After having built your application you can preview it locally with wrangler by running:

:pm-x{command="wrangler pages dev dist"}

### Deploy from your local machine using wrangler

After having built your application you can manually deploy it with wrangler, in order to do so first make sure to be
logged into your Cloudflare account:

:pm-x{command="wrangler login"}

Then you can deploy the application with:

:pm-x{command="wrangler pages deploy dist"}

## Cloudflare Module Workers

**Preset:** `cloudflare_module`

::note
**Note:** This preset uses the [module worker syntax](https://developers.cloudflare.com/workers/learning/migrating-to-module-workers/) for deployment.
::

When using Workers you will need a `wrangler.toml` file, in your root directory. To using Workers with [Static Assets](https://developers.cloudflare.com/workers/static-assets/) (BETA with [limitations](https://developers.cloudflare.com/workers/static-assets/#limitations)), you also need a compatibility date set to `2024-09-19` or later, in your `wrangler.toml` file and nitro configuration file.

The following shows a typical `wrangler.toml` file and a `nitro.config.ts` file for a Nitro application:

::code-group

```ts [nitro.config.ts]
export default defineNitroConfig({
    compatibilityDate: "2024-09-19",
})
```

```ts [nuxt.config.ts]
export default defineNuxtConfig({
    compatibilityDate: "2024-09-19",
})
```

::

```ini [wrangler.toml]
name = "nitro-app"
compatibility_date = "2024-09-19"
main = "./.output/server/index.mjs"
assets = { directory = "./.output/public/", binding = "ASSETS" }
```



## Runtime hooks

You can use [runtime hooks](/guide/plugins#nitro-runtime-hooks) below in order to extend [worker handlers](https://developers.cloudflare.com/workers/runtime-apis/handlers/).

:read-more{to="/guide/plugins#nitro-runtime-hooks"}

- [`cloudflare:scheduled`](https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/)
- [`cloudflare:email`](https://developers.cloudflare.com/email-routing/email-workers/runtime-api/)
- [`cloudflare:queue`](https://developers.cloudflare.com/queues/configuration/javascript-apis/#consumer)
- [`cloudflare:tail`](https://developers.cloudflare.com/workers/runtime-apis/handlers/tail/)
- `cloudflare:trace`


### Preview your app locally

You can use [wrangler](https://github.com/cloudflare/workers-sdk/tree/main/packages/wrangler), to preview your app locally:

```bash
NITRO_PRESET=cloudflare npm run build

# If you have added a 'wrangler.toml' file like above in the root of your project:
npx wrangler dev

# If you don't have a 'wrangler.toml', directly use:
npx wrangler dev .output/server/index.mjs --site .output/public
```

### Deploy from your local machine using wrangler

Install [wrangler](https://github.com/cloudflare/workers-sdk/tree/main/packages/wrangler) and login to your Cloudflare account:

```bash
npm i wrangler
wrangler login
```

Generate your app using the `cloudflare_module` preset:

```bash
NITRO_PRESET=cloudflare_module npm run build
```

You can then preview it locally:

```bash
# If you have a 'wrangler.toml' like above:
npx wrangler dev

# If you don't have a 'wrangler.toml':
npx wrangler dev .output/server/index.mjs --site .output/public
```

and publish it:

:pm-x{command="wrangler deploy"}

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

Regardless on whether you're using Cloudflare Pages or Cloudflare workers, you can use the [Wrangler GitHub actions](https://github.com/marketplace/actions/deploy-to-cloudflare-workers-with-wrangler) to deploy your application.

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

For production, use the cloudflare dashboard or the [`wrangler secret`](https://developers.cloudflare.com/workers/wrangler/commands/#secret) command to set environment variables and secrets.

### Specify Variables using `wrangler.toml`

You can specify a custom `wrangler.toml` file and define vars inside.

::note
**Note:** `wrangler.toml` isn't supported by cloudflare pages.
::

::warning
Note that this isn't recommend for sensitive data.
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

## Direct access to cloudflare bindings

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

### Access to the bindings in local env

In order to access bindings during local dev mode, regardless of the chosen preset, it is recommended to use a `wrangler.toml` file (as well as a `.dev.vars` one) in combination with the [`nitro-cloudflare-dev` module](https://github.com/nitrojs/nitro-cloudflare-dev) as illustrated below.

> [!NOTE]
> The `nitro-cloudflare-dev` module is experimental. The Nitro team is looking into a more native integration  which could in the near future make the module unneeded.

In order to access bindings in dev mode we start by defining the bindings in a `wrangler.toml` file, this is for example how you would define a variable and a KV namespace:

```ini [wrangler.toml]
[vars]
MY_VARIABLE="my-value"

[[kv_namespaces]]
binding = "MY_KV"
id = "xxx"
```

> [!NOTE]
> Only bindings in the default environment are recognized.

Next we install the `nitro-cloudflare-dev` module as well as the required `wrangler` package (if not already installed):

:pm-install{name="-D nitro-cloudflare-dev wrangler"}

Then define module:

::code-group

```js [nitro.config.js]
import nitroCloudflareBindings from "nitro-cloudflare-dev";

export default defineNitroConfig({
  modules: [nitroCloudflareBindings],
});
```

```ts [nuxt.config.ts]
export default defineNuxtConfig({
  modules: ['nitro-cloudflare-dev']
})
```

::

From this moment, when running

:pm-run{script="dev"}

you will be able to access the `MY_VARIABLE` and `MY_KV` from the request event just as illustrated above.
