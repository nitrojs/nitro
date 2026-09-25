# IIS

> Deploy Nitro apps to IIS.

## Using [IISnode](https://github.com/Azure/iisnode)

**Preset:** `iis_node`

1. Install the latest LTS version of [Node.js](https://nodejs.org/en/) on your Windows Server.
2. Install [IISnode](https://github.com/azure/iisnode/releases)
3. Install [IIS `URLRewrite` Module](https://www.iis.net/downloads/microsoft/url-rewrite).
4. In IIS, add `.mjs` as a new mime type and set its content type to `application/javascript`.
5. Deploy the contents of your `.output` folder to your website in IIS.

## Using IIS handler

**Preset:** `iis_handler`

You can use the IIS HttpPlatformHandler directly.

1. Install the latest LTS version of [Node.js](https://nodejs.org/en/) on your Windows Server.
2. Install [IIS `HttpPlatformHandler` Module](https://www.iis.net/downloads/microsoft/httpplatformhandler)
3. Copy your `.output` directory into the Windows Server, and create a website on IIS pointing to that exact directory.

## IIS config options

```ts [nitro.config.ts]
import { defineConfig } from "nitro";

export default defineConfig({
  iis: {
    // merge a pre-existing web.config file into the Nitro default file
    mergeConfig: true,
    // override the default Nitro web.config file altogether
    overrideConfig: false,
  },
});
```
