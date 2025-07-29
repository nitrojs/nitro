# Edgio

> Deploy Nitro apps to Edgio.

::warning
This preset is deprecated and will be removed in v3.
::

**Preset:** `edgio`

:read-more{title="edgio.io" to="https://edg.io/"}

Edgio (formerly Layer0) extends the capabilities of a traditional CDN by not only hosting your static content, but also providing server-side rendering for progressive web applications as well as caching both your APIs and HTML at the network edge to provide your users with the fastest browsing experience.

If this is your first time deploying to Edgio, the interactive CLI as part of the `deploy` command will prompt to authenticate using your browser. You may also [sign up](https://app.layer0.co/signup) prior to deployment.

## Install the Eedgio CLI

```bash
npm i -g @edgio/cli
```

## Testing production build locally with Edgio

You can use Nitropack to test your app's development experience locally:

```bash
NITRO_PRESET=edgio npx nitropack build
```

To simulate on local how your app would run in production with Edgio, run the following command:

```bash
edgio build && edgio run --production
```

## Deploying from your local machine

Once you have tested your application locally, you may deploy using:

```bash
edgio deploy
```

## Deploying using CI/CD

If you are deploying from a non-interactive environment, you will need to create an account on [Edgio Developer Console](https://app.layer0.co) first and setup a [deploy token](https://docs.edg.io/guides/basics/deployments#deploy-from-ci). Once the deploy token is created, save it as a secret to your environment. You can start the deploy by running:

```bash
edgio deploy --token=XXX
```
