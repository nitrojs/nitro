# Zephyr Cloud

> Deploy Nitro apps to [Zephyr Cloud](https://zephyr-cloud.io).

**Preset:** `zephyr`

:read-more{title="Zephyr Cloud Docs" to="https://docs.zephyr-cloud.io"}

Zephyr support is built into Nitro through the `zephyr` preset.

For most Zephyr-specific topics such as BYOC, cloud integrations, environments, and CI/CD authentication, refer to the [Zephyr Cloud docs](https://docs.zephyr-cloud.io).

::note
Zephyr is a little different from most Nitro deployment providers. Instead of targeting a single hosting vendor directly, Zephyr acts as a deployment control plane on top of either Zephyr-managed infrastructure or your own cloud integrations.
::

## BYOC model

Zephyr supports a BYOC (Bring Your Own Cloud) model. In Zephyr's architecture, the control plane stays managed by Zephyr, while the data plane (workers and storage) runs in your cloud accounts.

This lets you keep Zephyr's deployment workflow while using any supported Zephyr cloud integration. See the [Zephyr BYOC docs](https://docs.zephyr-cloud.io/features/byoc) for the current list of supported providers.

## Deploy with Nitro CLI

Use Nitro's deploy command to build and upload your app to Zephyr in one step:

```bash
npx nitro deploy --preset zephyr
```

Nitro will upload the generated output using `zephyr-agent`. If `zephyr-agent` is missing, Nitro will prompt to install it locally and will install it automatically in CI.

## Deploy during build

Zephyr is a little different here from most Nitro providers: we recommend enabling deployment during `nitro build` and treating build as the primary deployment step.

If your CI pipeline already runs `nitro build`, enable deployment during the build step:

```ts [nitro.config.ts]
import { defineNitroConfig } from "nitro/config";

export default defineNitroConfig({
  preset: "zephyr",
  zephyr: {
    deployOnBuild: true,
  },
});
```

Then your normal build command is enough:

:pm-run{script="build"}

After the build finishes, Nitro uploads the generated output to Zephyr, deploys it to the edge, and prints the deployment URL:

```txt
◐ Building [Nitro] (preset: zephyr, compatibility: YYYY-MM-DD)
...
ZEPHYR   Uploaded local snapshot in 110ms
ZEPHYR   Deployed to Zephyr's edge in 700ms.
ZEPHYR
ZEPHYR   https://my-app.zephyrcloud.app
```

## CI authentication

Zephyr requires an API token for non-interactive deployments. The example below uses the simpler personal-token style setup with `ZE_SECRET_TOKEN` together with `zephyr.deployOnBuild`.

```yaml [.github/workflows/deploy.yml]
name: Deploy with Zephyr

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      ZE_SECRET_TOKEN: ${{ secrets.ZEPHYR_AUTH_TOKEN }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
```

For more advanced CI/CD setups, Zephyr also documents organization-level server-token authentication using `ZE_SERVER_TOKEN`. See the [Zephyr CI/CD server token docs](https://docs.zephyr-cloud.io/features/ci-cd-server-token).

## Options

### `zephyr.deployOnBuild`

Deploy to Zephyr during `nitro build` when using the `zephyr` preset.

- Default: `false`
