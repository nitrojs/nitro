# Render.com

> Deploy Nitro apps to Render.com.

**Preset:** `render_com`

:read-more{title="render.com" to="https://render.com"}

## Set up application

1. [Create a new Web Service](https://dashboard.render.com/select-repo?type=web) and select the repository that contains your code.
2. Ensure the 'Node' environment is selected.
3. Update the start command to `node .output/server/index.mjs`
4. Click 'Advanced' and add an environment variable with `NITRO_PRESET` set to `render_com`. You may also need to add a `NODE_VERSION` environment variable set to `20` for the build to succeed ([docs](https://render.com/docs/node-version)).
5. Click 'Create Web Service'.

## Infrastructure as Code (IaC)

1. Create a file called `render.yaml` with following content at the root of your repository.

> This file followed by [Infrastructure as Code](https://render.com/docs/infrastructure-as-code) on Render

```yaml
services:
  - type: web
    name: <PROJECTNAME>
    env: node
    branch: main
    startCommand: node .output/server/index.mjs
    buildCommand: npx nypm install && npm run build
    envVars:
    - key: NITRO_PRESET
      value: render_com
```

1. [Create a new Blueprint Instance](https://dashboard.render.com/select-repo?type=blueprint) and select the repository containing your `render.yaml` file.

You should be good to go!
