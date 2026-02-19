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

```ts [nitro.config.ts]
import { defineNitroConfig } from "nitro/config";

export default defineNitroConfig({
    compatibilityDate: "2024-09-19",
    preset: "cloudflare_module",
    cloudflare: {
      deployConfig: true,
      nodeCompat: true
    }
})
```

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

You can use [runtime hooks](/docs/plugins#nitro-runtime-hooks) below in order to extend [Worker handlers](https://developers.cloudflare.com/workers/runtime-apis/handlers/).

:read-more{to="/guide/plugins#nitro-runtime-hooks"}

- [`cloudflare:scheduled`](https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/)
- [`cloudflare:email`](https://developers.cloudflare.com/email-routing/email-workers/runtime-api/)
- [`cloudflare:queue`](https://developers.cloudflare.com/queues/configuration/javascript-apis/#consumer)
- [`cloudflare:tail`](https://developers.cloudflare.com/workers/runtime-apis/handlers/tail/)
- `cloudflare:trace`

### Additional Exports

You can add a `exports.cloudflare.ts` file to your project root to export additional handlers or properties to the Cloudflare Worker entrypoint.

```ts [exports.cloudflare.ts]
export class MyWorkflow extends WorkflowEntrypoint {
  async run(event: WorkflowEvent, step: WorkflowStep) {
    // ...
  }
}
```

Nitro will automatically detect this file and include its exports in the final build.

::warning
The `exports.cloudflare.ts` file must not have a default export.
::

You can also customize the entrypoint file location using the `cloudflare.exports` option in your `nitro.config.ts`:

```ts [nitro.config.ts]
export default defineConfig({
  cloudflare: {
    exports: "custom-exports-entry.ts"
  }
})
```

### Scheduled Tasks (Cron Triggers)

When using [Nitro tasks](/docs/tasks) with `scheduledTasks`, Nitro automatically generates [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) in the wrangler config at build time.

```ts [nitro.config.ts]
import { defineNitroConfig } from "nitro/config";

export default defineNitroConfig({
  preset: "cloudflare_module",
  experimental: {
    tasks: true,
  },
  scheduledTasks: {
    "* * * * *": ["cms:update"],
    "0 15 1 * *": ["db:cleanup"],
  },
  cloudflare: {
    deployConfig: true,
  },
})
```

No manual Wrangler configuration is needed - Nitro handles it for you.

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

```ts [nitro.config.ts]
import { defineNitroConfig } from "nitro/config";

export default defineNitroConfig({
    preset: "cloudflare_pages",
    cloudflare: {
      deployConfig: true,
      nodeCompat:true
    }
})
```

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
import { defineHandler } from "nitro/h3";
import { useRuntimeConfig } from "nitro/runtime-config";

console.log(process.env.SECRET) // note that this is in the global scope! so it doesn't actually work and the variable is undefined!

export default defineHandler((event) => {
  // note that all the below are valid ways of accessing the above mentioned variables
  useRuntimeConfig().helloThere
  useRuntimeConfig().secret
  process.env.NITRO_HELLO_THERE
  import.meta.env.SECRET
});
```

### Specify Variables in Development Mode

For development, you can use a `.env` or `.env.local` file to specify environment variables:

```ini
NITRO_HELLO_THERE="captain"
SECRET="top-secret"
```

::note
**Note:** Make sure you add `.env` and `.env.local` to the `.gitignore` file so that you don't commit it as it can contain sensitive information.
::

### Specify Variables for local previews

After build, when you try out your project locally with `wrangler dev` or `wrangler pages dev`, in order to have access to environment variables you will need to specify the in a `.dev.vars` file in the root of your project (as presented in the [Pages](https://developers.cloudflare.com/pages/functions/bindings/#interact-with-your-environment-variables-locally) and [Workers](https://developers.cloudflare.com/workers/configuration/environment-variables/#interact-with-environment-variables-locally) documentation).

If you are using a `.env` or `.env.local` file while developing, your `.dev.vars` should be identical to it.

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

::code-group

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

```json [wrangler.json]
{
  "vars": {
    "NITRO_HELLO_THERE": "general",
    "SECRET": "secret"
  },
  "env": {
    "production": {
      "vars": {
        "NITRO_HELLO_THERE": "captain",
        "SECRET": "top-secret"
      }
    }
  }
}

```

::

## Direct access to Cloudflare bindings

Bindings are what allows you to interact with resources from the Cloudflare platform, examples of such resources are key-value data storages ([KVs](https://developers.cloudflare.com/kv/)) and serverless SQL databases ([D1s](https://developers.cloudflare.com/d1/)).

::read-more
For more details on Bindings and how to use them please refer to the Cloudflare [Pages](https://developers.cloudflare.com/pages/functions/bindings/) and [Workers](https://developers.cloudflare.com/workers/configuration/bindings/#bindings) documentation.
::

> [!TIP]
> Nitro provides high level API to interact with primitives such as [KV Storage](/docs/storage) and [Database](/docs/database) and you are highly recommended to prefer using them instead of directly depending on low-level APIs for usage stability.

:read-more{title="Database Layer" to="/docs/database"}

:read-more{title="KV Storage" to="/docs/storage"}

In runtime, you can access bindings from the request event, by accessing its `context.cloudflare.env` field, this is for example how you can access a D1 bindings:

```ts
import { defineHandler } from "nitro/h3";

defineHandler(async (event) => {
  const { cloudflare } = event.context
  const stmt = await cloudflare.env.MY_D1.prepare('SELECT id FROM table')
  const { results } = await stmt.all()
})
```

### Access to the bindings in local dev

To access bindings in dev mode, we first define them. You can do this in a `wrangler.jsonc`/`wrangler.json`/`wrangler.toml` file

For example, to define a variable and a KV namespace in `wrangler.toml`:

::code-group

```ini [wrangler.toml]
[vars]
MY_VARIABLE="my-value"

[[kv_namespaces]]
binding = "MY_KV"
id = "xxx"
```

```json [wrangler.json]
{
  "vars": {
    "MY_VARIABLE": "my-value",
  },
  "kv_namespaces": [
    {
      "binding": "MY_KV",
      "id": "xxx"
    }
  ]
}
```

::

Next we install the required `wrangler` package (if not already installed):

:pm-install{name="wrangler -D"}

From this moment, when running

:pm-run{script="dev"}

you will be able to access the `MY_VARIABLE` and `MY_KV` from the request event just as illustrated above.

#### Wrangler environments

If you have multiple Wrangler environments, you can specify which Wrangler environment to use during Cloudflare dev emulation:

```ts [nitro.config.ts]
import { defineNitroConfig } from "nitro/config";

export default defineNitroConfig({
  preset: 'cloudflare-module',
  cloudflare: {
    dev: {
      environment: 'preview'
    }
  }
})
```
