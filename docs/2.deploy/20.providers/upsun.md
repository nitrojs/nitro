# Upsun

> Deploy Nitro apps to Upsun

**Preset:** `upsun`

:read-more{to="https://upsun.com"}

::note
The old `platform_sh` preset name still works and resolves to `upsun`.
::

## Project creation

First, either create a new project on [Upsun](https://upsun.com):

```bash
upsun project:create
```

or link an existing project:

```bash
upsun project:set <project_id>
```

## Upsun configuration

Then in the repository create a `.upsun/config.yaml` file:

```yaml [.upsun/config.yaml]
applications:
  nitro:
    type: nodejs:24
    dependencies:
      nodejs:
        "pnpm": "*"
    source:
      root: "/"
    hooks:
      build: |
        set -eux
        pnpm install
        NITRO_PRESET=upsun pnpm build
    web:
      commands:
        start: "node .output/server/index.mjs"
      locations:
        "/":
          root: "dist/client"
          passthru: true
          allow: false
    mounts:
      ".data":
        source: storage
        source_path: data

routes:
  # Primary domain
  "https://{default}/":
    type: upstream
    upstream: "nitro:http"
    cache:
      enabled: true
      cookies: ["*"]
      default_ttl: 300
      headers: ["Accept", "Accept-Language"]
```

:read-more{title="Complete list of all available configuration properties" to="https://docs.upsun.com/get-started/here/configure/nodejs.html"}

:read-more{title="Nitro storage layer" to="/docs/storage"}

## Deployment

Once ready, deploy your `main` branch with:

```bash
git push upsun main
```

or if you have the Upsun CLI client installed:

```bash
upsun deploy
```

The Upsun pipeline then builds and deploys the project:

```bash
Building application 'nitro' (runtime type: nodejs:24)
  Executing build hook...
    W: + pnpm install
    W: + pnpm build
    [info] [nitro] Building Nitro Server (preset: `upsun`)
    [success] [nitro] Nitro Server built

Redeploying environment main
  Environment routes
    https://example.org/ is served by application `nitro`
```

For any support, please reach out to [the Upsun team on Discord](https://discord.com/invite/upsun).
