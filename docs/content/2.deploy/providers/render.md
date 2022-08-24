---
title: Render.com
description: 'Discover Render.com preset for Nitro!'
---

**Preset:** `render-com` ([switch to this preset](/deploy/#changing-the-deployment-preset))

Nitro supports deploying on [Render](https://render.com/) with minimal configuration.

## Set up application

1. [Create a new Web Service](https://dashboard.render.com/select-repo?type=web) and select the repository that contains your code.

1. Ensure the 'Node' environment is selected.

1. Depending on your package manager, set the build command to `yarn && yarn build`, `npm install && npm run build`, or `pnpm i --shamefully-hoist && pnpm build`.

1. Update the start command to `node .output/server/index.mjs`

1. Click 'Advanced' and add an environment variable with `NITRO_PRESET` set to `render-com`.

1. Click 'Create Web Service'.

You should be good to go!
