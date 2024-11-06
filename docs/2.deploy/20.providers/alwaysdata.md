# alwaysdata

> Deploy Nitro apps to alwaysdata.

**Preset:** `alwaysdata`

:read-more{to="https://alwaysdata.com"}

## Set up application

### Pre-requisites

1. [Register a new profile](https://www.alwaysdata.com/en/register/) on alwaysdata platform if you don't have one.

2. Get a free 100Mb plan to host your app.

> [!NOTE]
> Keep in mind your *account name* will be used to provide you a default URL in the form of `account_name.alwaysdata.net`, so choose it wisely. You can also link your existing domains to your account later or register as many accounts under your profile as you need.

### Local deployment

1. Build your project locally with `npm run build -- preset alwaysdata`

2. [Upload your app](https://help.alwaysdata.com/en/remote-access/) to your account in its own directory (e.g. `$HOME/www/my-app`). You can use any protocol you prefer (SSH/FTP/WebDAV…) to do so.

3. On your admin panel, [create a new site](https://admin.alwaysdata.com/site/add/) for your app with the following features:
   - *Addresses*: `[account_name].alwaysdata.net`
   - *Type*: Node.js
   - *Command*: `node ./output/server/index.mjs`
   - *Working directory*: `www/my-app` (adapt it to your deployment path)
   - *Environment*:

     ```ini
     NITRO_PRESET=alwaysdata
     ```

   - *Node.js version*: `Default version` is fine; pick no less than `20.0.0` (you can also [set your Node.js version globally](https://help.alwaysdata.com/en/languages/nodejs/configuration/#supported-versions))
   - *Hot restart*: `SIGHUP`

   :read-more{title="Get more information about alwaysdata Node.js sites type" to="https://help.alwaysdata.com/en/languages/nodejs"}

4. Your app is now live at `http(s)://[account_name].alwaysdata.net`.
