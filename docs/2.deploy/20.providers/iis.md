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

You can use IIS http handler directly.

1. Install the latest LTS version of [Node.js](https://nodejs.org/en/) on your Windows Server.
2. Install [IIS `HttpPlatformHandler` Module](https://www.iis.net/downloads/microsoft/httpplatformhandler)
3. Copy your `.output` directory into the Windows Server, and create a website on IIS pointing to that exact directory.

## IIS config options

```ts [nitro.config.ts]
export default defineNitroConfig({
  // IIS options default
  iis: {
    // merges in a pre-existing web.config file to the nitro default file
    mergeConfig: true,
    // overrides the default nitro web.config file all together
    overrideConfig: false,
  },
});
```
