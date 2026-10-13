# DigitalOcean

> Deploy Nitro apps to DigitalOcean.

**Preset:** `digital_ocean`

:read-more{title="DigitalOcean App Platform" to="https://docs.digitalocean.com/products/app-platform/"}

## Set up application

1. Create a new DigitalOcean app following the [guide](https://docs.digitalocean.com/products/app-platform/how-to/create-apps/).

1. Next, configure environment variables. In your app settings, ensure the following app-level environment variable is set:

   ```bash
   NITRO_PRESET=digital_ocean
   ```

   [More information](https://docs.digitalocean.com/products/app-platform/how-to/use-environment-variables/).

1. Set an `engines.node` field in your app's `package.json` so DigitalOcean uses a supported version of Node.js:

   ```json
   {
      "engines": {
         "node": "20.x"
      }
   }
   ```

   [See more information](https://docs.digitalocean.com/products/app-platform/languages-frameworks/nodejs/#node-version).

1. Add a start script to your `package.json` so DigitalOcean knows what command to run after a build:

   ```json
   {
      "scripts": {
         "start": "node .output/server/index.mjs"
      }
   }
   ```

1. Finally, add this start script to your DigitalOcean app's run command. Go to `Components > Settings > Commands`, click "Edit", then add `npm run start`.

Your app should now be live at a DigitalOcean-generated URL, and you can follow [the rest of the DigitalOcean deployment guide](https://docs.digitalocean.com/products/app-platform/how-to/manage-deployments/).
