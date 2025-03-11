# Firebase App Hosting

> Deploy Nitro apps to Firebase App Hosting.

::note
You will need to be on the [**Blaze plan**](https://firebase.google.com/pricing) (Pay as you go) to get started.
::

Preset: `firebase_app_hosting`

:read-more{title="Firebase App Hosting" to="https://firebase.google.com/docs/app-hosting"}

::tip
You can integrate with this provider using [zero configuration](/deploy/#zero-config-providers).
::

## Project setup

1. Go to the Firebase [console](https://console.firebase.google.com/) and set up a new project.
2. Select **Build > App Hosting** from the sidebar.
    - You may need to upgrade your billing plan at this step.
3. Click **Get Started**.
    - Choose a region.
    - Import a GitHub repository (you’ll need to link your GitHub account).
    - Configure deployment settings (project root directory and branch), and enable automatic rollouts.
    - Choose a unique ID for deployment.
4. Wait for the first release to complete.
