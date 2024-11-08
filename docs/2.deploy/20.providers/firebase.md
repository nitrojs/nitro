# Firebase

> Deploy Nitro apps to Firebase hosting.

::note
You will need to be on the [**Blaze plan**](https://firebase.google.com/pricing) (Pay as you go) to get started.
::

<!--

## Firebase app hosting <sup>(beta)</sup>

Preset: `firebase_app_hosting`

:read-more{title="Firebase App Hosting" to="https://firebase.google.com/docs/app-hosting"}

::important
Firebase app hosting support is currently available in the Nitro [nightly release channel](/guide/nightly).
::

::tip
You can integrate with this provider using [zero configuration](/deploy/#zero-config-providers).
::

### Project setup

1. Go to the Firebase [console](https://console.firebase.google.com/) and set up a new project.
2. Select **Build > App Hosting** from the sidebar.
    - You may need to upgrade your billing plan at this step.
3. Click **Get Started**.
    - Choose a region.
    - Import a GitHub repository (you’ll need to link your GitHub account).
    - Configure deployment settings (project root directory and branch), and enable automatic rollouts.
    - Choose a unique ID for deployment.
4. Wait for the first release to complete.

-->

## Firebase hosting

**Preset:** `firebase`

:read-more{title="Firebase Hosting" to="https://firebase.google.com/docs/hosting"}

::important
This preset will deploy to firebase functions 1st gen by default. If you want to deploy to firebase functions 2nd gen, see the [instructions below](#using-2nd-generation-firebase-functions).
::

### Project Setup

#### Using firebase CLI (recommended)

You may instead prefer to set up your project with the Firebase CLI, which will fetch your project ID for you, add required dependencies (see above) and even set up automated deployments via GitHub Actions (for hosting only). [Learn about installing the firebase CLI](https://firebase.google.com/docs/cli#windows-npm).

1. Install firebase CLI globally

Always try to use the latest version of the Firebase CLI.

```bash
npm install -g firebase-tools@latest
```

**Note**: You need to be on [^11.18.0](https://github.com/firebase/firebase-tools/releases/tag/v11.18.0) to deploy a `nodejs18` function.

2. Initialize your firebase project

```bash
firebase login
firebase init hosting
```

When prompted, you can enter `.output/public` as the public directory. In the next step, **do not** configure your project as a single-page app.

Once complete, add the following to your `firebase.json` to enable server rendering in Cloud Functions:

```json [firebase.json]
{
  "functions": { "source": ".output/server" },
  "hosting": [
    {
      "site": "<your_project_id>",
      "public": ".output/public",
      "cleanUrls": true,
      "rewrites": [{ "source": "**", "function": "server" }]
    }
  ]
}
```

You can find more details in the [Firebase documentation](https://firebase.google.com/docs/hosting/quickstart).

#### Alternative method

If you don't already have a `firebase.json` in your root directory, Nitro will create one the first time you run it. In this file, you will need to replace `<your_project_id>` with the ID of your Firebase project. This file should then be committed to the git.

1. Create a `.firebaserc` file

It is recommended to create a `.firebaserc` file so you don't need to manually pass your project ID to your `firebase` commands (with `--project <your_project_id>`):

```json [.firebaserc]
{
  "projects": {
    "default": "<your_project_id>"
  }
}
```

This file is usually generated when you initialize your project with the Firebase CLI. But if you don't have one, you can create it manually.

2. Install firebase dependencies

Then, add Firebase dependencies to your project:

:pm-install{name="firebase-admin firebase-functions firebase-functions-test" dev}

3. Log into the firebase CLI

Make sure you are authenticated with the firebase cli. Run this command and follow the prompts:

:pm-x{command="firebase-tools login"}

### Local preview

You can preview a local version of your site if you need to test things out without deploying.

```bash
NITRO_PRESET=firebase npm run build
firebase emulators:start
```

### Build and deploy

Deploy to Firebase Hosting by running a Nitro build and then running the `firebase deploy` command.

```bash
NITRO_PRESET=firebase npm run build
```

:pm-x{command="firebase-tools deploy"}

If you installed the Firebase CLI globally, you can also run:

```bash
firebase deploy
```

### Using 2nd generation firebase functions

- [Comparison between 1st and 2nd generation functions](https://firebase.google.com/docs/functions/version-comparison)

To switch to the more recent and, recommended generation of firebase functions, set the `firebase.gen` option to `2`:

::code-group

```ts{3} [nitro.config.ts]
export default defineNitroConfig({
  firebase: {
    gen: 2
    // ...
  }
})
```

```ts{4} [nuxt.config.ts]
export default defineNuxtConfig({
  nitro: {
    firebase: {
      gen: 2
      // ...
    }
  }
})
```

::

::note
If you cannot use configuration for any reason, alternatively you can use `NITRO_FIREBASE_GEN` environment variable.
::

If you already have a deployed version of your website and want to upgrade to 2nd gen, [see the Migration process on Firebase docs](https://firebase.google.com/docs/functions/2nd-gen-upgrade). Namely, the CLI will ask you to delete your existing functions before deploying the new ones.

### Options

You can set options for the firebase functions in your `nitro.config.ts` file:

::code-group

```ts [nitro.config.ts]
export default defineNitroConfig({
  firebase: {
    gen: 2,
    httpsOptions: {
      region: 'europe-west1',
      maxInstances: 3,
    },
  },
});
```

```ts [nuxt.config.ts]
export default defineNuxtConfig({
  nitro: {
    firebase: {
      gen: 2,
      httpsOptions: {
        region: 'europe-west1',
        maxInstances: 3,
      },
    },
  },
});
```

::

You can also set options for 1st generation Cloud Functions if the `gen` option is set to `1`. Note these are different from the options for 2nd generation Cloud Functions.

#### Runtime Node.js version

You can set custom Node.js version in configuration:

::code-group

```ts [nitro.config.ts]
export default defineNitroConfig({
  firebase: {
    nodeVersion: "20" // Can be "16", "18", "20" or "22"
  },
});
```

```ts [nuxt.config.ts]
export default defineNuxtConfig({
  nitro: {
    firebase: {
      nodeVersion: "20" // Can be "16", "18", "20" or "22"
    },
  },
});
```

::

Firebase tools use the `engines.node` version in  `package.json` to determine which node version to use for your functions. Nitro automatically writes to the `.output/server/package.json` with configured Node.js version.

You might also need to add a runtime key to your `firebase.json` file:

```json [firebase.json]
{
  "functions": {
    "source": ".output/server",
    "runtime": "nodejs20"
  }
}
```

You can read more about this in [Firebase Docs](https://firebase.google.com/docs/functions/manage-functions?gen=2nd#set_nodejs_version).

### If your firebase project has other cloud functions

You may be warned that other cloud functions will be deleted when you deploy your nitro project. This is because nitro will deploy your entire project to firebase functions. If you want to deploy only your nitro project, you can use the `--only` flag:

```bash
firebase deploy --only functions:server,hosting
```

### Advanced

#### Renaming function

When deploying multiple apps within the same Firebase project, you must give your server a unique name in order to avoid overwriting
your functions.

You can specify a new name for the deployed Firebase function in your configuration:

::code-group

```ts [nitro.config.ts]
export default defineNitroConfig({
  firebase: {
    serverFunctionName: "<new_function_name>"
  }
})
```

```ts [nuxt.config.ts]
export default defineNuxtConfig({
  nitro: {
    firebase: {
      serverFunctionName: "<new_function_name>"
    }
  }
})
```

::

::important
`firebase.serverFunctionName` must be a valid JS variable name and cannot include dashes (`-`).
::
