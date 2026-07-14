# Firebase

> Deploy Nitro apps to Firebase.

::note
You will need to be on the [**Blaze plan**](https://firebase.google.com/pricing) (Pay as you go) to get started.
::

## Firebase App Hosting

**Preset:** `firebase_app_hosting`

:read-more{title="Firebase App Hosting" to="https://firebase.google.com/docs/app-hosting"}

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
    - Choose a unique ID for your backend.
4. Click **Finish & Deploy** to create your first rollout.

When you deploy with Firebase App Hosting, the App Hosting preset is enabled automatically at build time.

### Run configuration

You can customize the generated [App Hosting output bundle](https://firebase.google.com/docs/app-hosting/build-config) run configuration using the `firebase.appHosting` option in your Nitro config:

```ts [nitro.config.ts]
import { defineConfig } from "nitro";

export default defineConfig({
  firebase: {
    appHosting: {
      cpu: 1,
      memoryMiB: 512,
      concurrency: 80,
      minInstances: 0,
      maxInstances: 10,
    },
  },
});
```

Supported values include `runCommand`, `environmentVariables`, `concurrency`, `cpu`, `memoryMiB`, `minInstances`, and `maxInstances`.
