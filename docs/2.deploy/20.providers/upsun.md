# Upsun (formerly Platform.sh)

> Deploy Nitro apps to Upsun

**Preset:** `upsun`

:read-more{to="https://upsun.com"}

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
      root: "sting9.org"
    hooks:
      build: |
        set -eux
        pnpm install
        NITR_PRESET=upsun pnpm build
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
      # Cache based on URI and query parameters
      cookies: ["*"]
      default_ttl: 300
      # Don't cache these paths
      headers: ["Accept", "Accept-Language"]
```

:read-more{title="Complete list of all available configuration properties" to="https://docs.upsun.com/get-started/here/configure/nodejs.html"}

## Deployment

Once ready, deploy your `main` branch with:

```bash
git push upsun main
```

or if you have the Upsun CLI client installed:

```bash
upsun deploy
```

The Upsun pipeline will then build and deploy the Nitro project:

```bash
Found 1 new commit

Configuring resources

Building application 'nitro' (runtime type: nodejs:24, tree: 881416a)
  Generating runtime configuration.

  Installing build dependencies...
    Installing nodejs build dependencies: pnpm

    added 1 package in 2s

    1 package is looking for funding
      run `npm fund` for details

  Building a NodeJS application, let's make it fly.
  Found a `package.json`, installing dependencies.

    added 1017 packages, and audited 1019 packages in 1m

    331 packages are looking for funding
      run `npm fund` for details

  Executing build hook...
    W: + pnpm install
    Lockfile is up to date, resolution step is skipped
    Progress: resolved 1, reused 0, downloaded 0, added 0
    Packages: +867
    ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    Progress: resolved 867, reused 0, downloaded 0, added 0
    Progress: resolved 867, reused 0, downloaded 51, added 48
    ...
    Progress: resolved 867, reused 0, downloaded 867, added 867, done

    dependencies:
    + nitro 3.0.1-alpha.1
    + react 19.2.0
    + react-dom 19.2.0
    [...]

    Done in 16s using pnpm v10.22.0
    W: + pnpm build

    > .@ build /app
    > vite build

    vite v7.2.2 building client environment for production...
    transforming...
    ✓ 2236 modules transformed.
    rendering chunks...
    computing gzip size...
    dist/client/assets/styles-C22_ZIma.css                            62.51 kB │ gzip:  10.10 kB
    ...
    dist/client/assets/main-CQbNgDGY.js                              367.55 kB │ gzip: 118.03 kB
    ✓ built in 7.74s
    vite v7.2.2 building ssr environment for production...
    transforming...
    ✓ 131 modules transformed.
    rendering chunks...
    ✓ built in 1.54s
    W: [warn] [nitro] Please add `compatibilityDate: '2025-11-16'` to the config file. Using `2024-04-03` as fallback.
    W:        More info: https://nitro.build/deploy#compatibility-date
    [success] [nitro] Generated public .output/public
    [info] [nitro] Building Nitro Server (preset: `node-server`, compatibility date: ``)
    [success] [nitro] Nitro Server built
      ├─ .output/server/chunks/_/_tanstack-start-manifest_v-DJIcFhvO.mjs (6.66 kB) (1.35 kB gzip)
      ├─ .output/server/index.mjs (174 kB) (43.2 kB gzip)
      └─ .output/server/package.json (4.17 kB) (1.17 kB gzip)
    Σ Total size: 5.97 MB (1.42 MB gzip)
    [success] [nitro] You can preview this build using `node .output/server/index.mjs`

  Executing pre-flight checks...

  Compressing application.
  Beaming package to its final destination.

Redeploying environment main
  Preparing deployment

  Serving cached content for application nitro
  Closing service nitro
  Updating endpoints for nitro, api, and router
  Opening application nitro and its relationships
  Opening environment
  Environment configuration
    nitro (type: nodejs:24, cpu: 0.5, memory: 224, disk: 0)

  Environment routes
    http://example.org/ redirects to https://example.org/
    https://example.org/ is served by application `nitro`

Blackfire post-deploy event sent
```

For any support, please reach out to [the Upsun team on Discord](https://discord.com/invite/upsun).
