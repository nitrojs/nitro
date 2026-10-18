# Sevalla

> Deploy Nitro apps to Sevalla.

**Preset:** `sevalla`

:read-more{title="sevalla.com" to="https://sevalla.com"}

## Setup

1. [Create a new app](https://docs.sevalla.com/applications/get-started/add-an-application) on Sevalla and connect it to your Git repository.
2. Set the **application name**, **region**, and **pod size** (you can start with 0.5 CPU / 1GB RAM).  
3. Click **Create**, but skip the deploy step for now.  
4. In your Sevalla application dashboard, click **Environment variables** on the sidebar and set `NITRO_PRESET` to `sevalla`.
5. Ensure your project specifies a supported Node version in `package.json` (Sevalla's default Nixpacks uses Node 18, but Nitro requires Node 20+):

    :::code-group
    ```json [package.json]
    {
      "engines": {
        "node": "22.x"
      }
    }
    ```
    :::

6. Go to your application's **Deployment** tab and click **Deploy now**. Sevalla will automatically build and deploy your Nitro application.

## Static Assets

For optimal performance, consider enabling Sevalla's free Cloudflare-powered CDN to serve your static assets:

1. Go to **Applications** > **your app** > **Networking**
2. Under **CDN/Edge caching**, click **Edit settings**
3. Enable **CDN status**

The CDN will automatically cache and serve static files (CSS, JS, images, fonts, etc.) from Cloudflare's global network.

Learn more about the [different ways](https://docs.sevalla.com/applications/build-options/dockerfile) to deploy your application and [set up a database](https://docs.sevalla.com/databases/overview) in our [documentation](https://docs.sevalla.com/).


