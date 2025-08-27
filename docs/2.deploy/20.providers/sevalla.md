# Sevalla

> Deploy Nitro apps to Sevalla.

**Preset:** `sevalla`

:read-more{title="sevalla.com" to="https://sevalla.com"}

## Setup

1. [Create a new app](https://docs.sevalla.com/applications/get-started/add-an-application) on Sevalla and connect it to your Git repository.
2. Set the **application name**, **region**, and **pod size** (you can start with 0.5 CPU / 1GB RAM).  
3. Click **Create**, but skip the deploy step for now.  
4. In your Sevalla application dashboard, click **Environment variables** on the sidebar and set `NITRO_PRESET` to `sevalla`.
5. Ensure your project specifies a supported Node version in `package.json`:

    :::code-group
    ```json [package.json]
    {
      "engines": {
        "node": "22.x"
      }
    }
    ```
    :::

6. Add the necessary build and start scripts in your `package.json`:

    :::code-group
    ```json [package.json]
    {
      "scripts": {
        "build": "nitro build",  // or `nuxt build` if using Nuxt
        "start": "node .output/server/index.mjs"
      }
    }
    ```
    :::

7. Go to your application's **Deployment** tab and click **Deploy now**. Sevalla will automatically build and deploy your Nitro application.

Learn more about the [different ways](https://docs.sevalla.com/applications/build-options/dockerfile) to deploy your application and [set up a database](https://docs.sevalla.com/databases/overview) in our [documentation](https://docs.sevalla.com/).


