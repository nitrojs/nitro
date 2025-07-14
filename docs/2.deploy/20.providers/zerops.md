# Zerops

> Deploy Nitro apps to [Zerops](https://zerops.io).

**Preset:** `zerops`

:read-more{title="zerops.io" to="https://zerops.io"}

> [!IMPORTANT]
> 🚧 This preset is currently experimental.

Zerops supports deploying both static and server-side rendered apps with a simple configuration file in your project root.

## Starter templates

If you want to quckly get started with zerops and nitro you can use repositories [`zeropsio/recipe-nitro-nodejs`](https://github.com/zeropsio/recipe-nitro-nodejs) and [`zeropsio/recipe-nitro-static`](https://github.com/zeropsio/recipe-nitro-static) starter templates.

## Project setup

Projects and services can be added either through [project add wizard](https://app.zerops.io/dashboard/project-add) or imported using `zerops-project-import.yml`.

::code-group
```yml [zerops-project-import.yml (node.js)]
project:
  name: nitro-app

services:
  - hostname: app
    type: nodejs@20
```
```yml [zerops-project-import.yml (static)]
project:
  name: nitro-app

services:
  - hostname: app
    type: static
```
::

Then create a `zerops.yml` config in your project root:

::code-group
```yml [zerops.yml (node.js)]
zerops:
  - setup: app
    build:
      base: nodejs@20
      envVariables:
        SERVER_PRESET: zerops
      buildCommands:
        - pnpm i
        - pnpm run build
      deployFiles:
        - .output
        - package.json
        - node_modules
    run:
      base: nodejs@20
      ports:
        - port: 3000
          httpSupport: true
      start: node .output/server/index.mjs
```
```yml [zerops.yml (static)]
zerops:
  - setup: app
    build:
      base: nodejs@20
      envVariables:
        SERVER_PRESET: zerops-static
      buildCommands:
        - pnpm i
        - pnpm build
      deployFiles:
        - .zerops/output/static/~
    run:
      base: static
```
::

Now you can trigger the [build & deploy pipeline using the Zerops CLI](#building-deploying-your-app) or by connecting the app service with your [GitHub](https://docs.zerops.io/references/github-integration/) / [GitLab](https://docs.zerops.io/references/gitlab-integration) repository from inside the service detail.


## Build and deploy

Open [Settings > Access Token Management](https://app.zerops.io/settings/token-management) in the Zerops app and generate a new access token.

Log in using your access token with the following command:

:pm-x{command="@zerops/zcli login <token>"}

Navigate to the root of your app (where `zerops.yml` is located) and run the following command to trigger the deploy:

:pm-x{command="@zerops/zcli push"}

Your code can be deployed automatically on each commit or a new tag by connecting the service with your [GitHub](https://docs.zerops.io/references/gitlab-integration) / [GitLab](https://docs.zerops.io/references/gitlab-integration) repository. This connection can be set up in the service detail.


:read-more{title="Zerops Documentation" to="https://docs.zerops.io/"}
