# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## v2.13.1

[compare changes](https://github.com/nitrojs/nitro/compare/v2.13.0...v2.13.1)

### 🏡 Chore

- Update deps ([696dc3a9](https://github.com/nitrojs/nitro/commit/696dc3a9))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))

## v2.13.0

[compare changes](https://github.com/nitrojs/nitro/compare/v2.12.9...v2.13.0)

### 🚀 Enhancements

- **vercel:** Add support for skew protection ([#3850](https://github.com/nitrojs/nitro/pull/3850))
- **bun:** Support `NITRO_BUN_IDLE_TIMEOUT` env ([#3294](https://github.com/nitrojs/nitro/pull/3294))

### 🔥 Performance

- Limit concurrency for compressing public assets ([#3384](https://github.com/nitrojs/nitro/pull/3384))
- Process static assets in parallel ([#3910](https://github.com/nitrojs/nitro/pull/3910))

### 🩹 Fixes

- **firebase:** Update gen 1 import to match latest sdk ([28406449](https://github.com/nitrojs/nitro/commit/28406449))
- Correct `crypto` polyfill ([5caca6c0](https://github.com/nitrojs/nitro/commit/5caca6c0))
- **vercel:** Handle ISR requests with `passQuery: true` ([#3539](https://github.com/nitrojs/nitro/pull/3539))
- **dev:** Automatically use `Content-Encoding: gzip` for `.gz` static files ([#3381](https://github.com/nitrojs/nitro/pull/3381))
- **static:** Add `vary: accept-encoding` for assets with compressed version ([#3443](https://github.com/nitrojs/nitro/pull/3443))
- **dev:** Respect `opts.json` when `false` for error handler ([#3920](https://github.com/nitrojs/nitro/pull/3920))
- **dev:** Apply headers from route rules for static assets ([c74d7a17](https://github.com/nitrojs/nitro/commit/c74d7a17))
- Avoid long caching dev assets ([f059e4ba](https://github.com/nitrojs/nitro/commit/f059e4ba))
- Use real pathname ([be316b49](https://github.com/nitrojs/nitro/commit/be316b49))
- **vercel:** Avoid adding o11y links for prerendered paths ([#3927](https://github.com/nitrojs/nitro/pull/3927))
- **cloudflare-durable:** Expose env bindings in durable handler ([#3931](https://github.com/nitrojs/nitro/pull/3931))

### 💅 Refactors

- Update `firebase-functions` type import ([d27fbe86](https://github.com/nitrojs/nitro/commit/d27fbe86))

### 📖 Documentation

- **vercel:** Uncomment `vercel.json` section ([c2d08819](https://github.com/nitrojs/nitro/commit/c2d08819))
- Add versions select ([#3855](https://github.com/nitrojs/nitro/pull/3855))
- Fix compatibilityDate value ([#3570](https://github.com/nitrojs/nitro/pull/3570))

### 📦 Build

- Update esbuild to 0.27 ([a0176dfa](https://github.com/nitrojs/nitro/commit/a0176dfa))
- Update unwasm to 0.5 ([85b057b8](https://github.com/nitrojs/nitro/commit/85b057b8))
- Update `@vercel/nft` to v1 ([5aeb9f89](https://github.com/nitrojs/nitro/commit/5aeb9f89))
- Update `@rollup/plugin-commonjs` to v29 ([58d2ff13](https://github.com/nitrojs/nitro/commit/58d2ff13))
- Update `@rollup/plugin-alias` to v6 ([3f493325](https://github.com/nitrojs/nitro/commit/3f493325))
- Update globby to v16 ([7b8da4c0](https://github.com/nitrojs/nitro/commit/7b8da4c0))

### 🏡 Chore

- Update non major deps ([8421267e](https://github.com/nitrojs/nitro/commit/8421267e))
- Update lockfile ([9954bcb9](https://github.com/nitrojs/nitro/commit/9954bcb9))
- Apply automated updates ([aa7838cf](https://github.com/nitrojs/nitro/commit/aa7838cf))
- Update dev deps ([2cefac59](https://github.com/nitrojs/nitro/commit/2cefac59))
- Update pnpm ([156de31b](https://github.com/nitrojs/nitro/commit/156de31b))
- Update deps ([b551976e](https://github.com/nitrojs/nitro/commit/b551976e))
- Update deps ([7013d6aa](https://github.com/nitrojs/nitro/commit/7013d6aa))
- Lint ([d9892e1a](https://github.com/nitrojs/nitro/commit/d9892e1a))
- Fix type error ([1e9a7f50](https://github.com/nitrojs/nitro/commit/1e9a7f50))
- Apply automated updates ([5a051ed6](https://github.com/nitrojs/nitro/commit/5a051ed6))
- Update deps ([28efb73e](https://github.com/nitrojs/nitro/commit/28efb73e))

### 🤖 CI

- Update actions ([ee6eaa24](https://github.com/nitrojs/nitro/commit/ee6eaa24))
- Avoid bumping h3 to nightly ([0b5a9c37](https://github.com/nitrojs/nitro/commit/0b5a9c37))
- Correct ref check for nightly ([de8d24c4](https://github.com/nitrojs/nitro/commit/de8d24c4))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))
- Ori ([@oritwoen](https://github.com/oritwoen))
- Dmitry Istomin ([@tirojal](https://github.com/tirojal))
- Typed SIGTERM ([@typed-sigterm](https://github.com/typed-sigterm))
- Daniel Roe ([@danielroe](https://github.com/danielroe))
- Oyama Michinoku ([@yamanoku](https://github.com/yamanoku))
- WIP ([@paulcrussell](https://github.com/paulcrussell))
- Kricsleo ([@kricsleo](https://github.com/kricsleo))
- Jamaluddin Rumi <16121031@student.mercubuana-yogya.ac.id>
- Sébastien Chopin <seb@nuxt.com>

## v2.12.9

[compare changes](https://github.com/nitrojs/nitro/compare/v2.12.8...v2.12.9)

### 🩹 Fixes

- Set explicit delimiters to allow $ in replacements ([#3689](https://github.com/nitrojs/nitro/pull/3689))

### 💅 Refactors

- **vercel:** Support bun runtime ([#3678](https://github.com/nitrojs/nitro/pull/3678))

### 🏡 Chore

- Update deps ([9202a3a0](https://github.com/nitrojs/nitro/commit/9202a3a0))
- Update dependencies ([d39e811e](https://github.com/nitrojs/nitro/commit/d39e811e))
- Update release script ([33f7ba4b](https://github.com/nitrojs/nitro/commit/33f7ba4b))
- Update unenv ([883da31c](https://github.com/nitrojs/nitro/commit/883da31c))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))
- Tom Lienard ([@QuiiBz](https://github.com/QuiiBz))
- James Garbutt ([@43081j](https://github.com/43081j))

## v2.12.8

[compare changes](https://github.com/nitrojs/nitro/compare/v2.12.7...v2.12.8)

### 🩹 Fixes

- **cloudflare:** Await on `getPlatformProxy()` global env in dev ([#3657](https://github.com/nitrojs/nitro/pull/3657))
- **build:** Avoid replacing `window$1` ([#3672](https://github.com/nitrojs/nitro/pull/3672))
- **cloudflare:** Add `cloudflare:workers` alias in dev ([#3663](https://github.com/nitrojs/nitro/pull/3663))
- Support autoimports `typeFrom` property for declaration gen ([#3670](https://github.com/nitrojs/nitro/pull/3670))

### 🏡 Chore

- Update dependencies ([6e36153b](https://github.com/nitrojs/nitro/commit/6e36153b))

### 🤖 CI

- Try pkg.pr.new ([e675f80b](https://github.com/nitrojs/nitro/commit/e675f80b))
- Add condition for pkg-pr-new ([c289b4a3](https://github.com/nitrojs/nitro/commit/c289b4a3))

### ❤️ Contributors

- Octavio Araiza ([@8ctavio](https://github.com/8ctavio))
- Rihan Arfan ([@RihanArfan](https://github.com/RihanArfan))
- Pooya Parsa ([@pi0](https://github.com/pi0))

## v2.12.7

[compare changes](https://github.com/nitrojs/nitro/compare/v2.12.6...v2.12.7)

### 🩹 Fixes

- **vercel:** Always add `url` to src regex for `isr` routes ([#3595](https://github.com/nitrojs/nitro/pull/3595))

### 🏡 Chore

- Update undocs ([0cb10c6e](https://github.com/nitrojs/nitro/commit/0cb10c6e))
- Update ci scripts ([9fc50d52](https://github.com/nitrojs/nitro/commit/9fc50d52))
- Update ci scripts ([2186bf25](https://github.com/nitrojs/nitro/commit/2186bf25))
- Update dependencies ([9854bbec](https://github.com/nitrojs/nitro/commit/9854bbec))

### 🤖 CI

- Update renovate config ([#3610](https://github.com/nitrojs/nitro/pull/3610))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))
- Giorgio Boa ([@gioboa](https://github.com/gioboa))

## v2.12.6

[compare changes](https://github.com/nitrojs/nitro/compare/v2.12.5...v2.12.6)

### 🩹 Fixes

- **vercel:** Generate prerender config for o11y routes matching `isr` route rule ([#3562](https://github.com/nitrojs/nitro/pull/3562))
- **vercel:** Skip o11y routes matching `isr` route rule ([#3563](https://github.com/nitrojs/nitro/pull/3563))
- **vercel:** Use `-isr` as suffix ([bde8ce85](https://github.com/nitrojs/nitro/commit/bde8ce85))
- **vercel:** Add `/` isr handler before wildcards ([81c2f9cd](https://github.com/nitrojs/nitro/commit/81c2f9cd))

### 💅 Refactors

- **vercel:** Better o11y for isr cached routes ([#3560](https://github.com/nitrojs/nitro/pull/3560))

### 🏡 Chore

- Update dependencies ([4871c9ca](https://github.com/nitrojs/nitro/commit/4871c9ca))
- Update deps ([aed86581](https://github.com/nitrojs/nitro/commit/aed86581))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))
- Daniel Roe ([@danielroe](https://github.com/danielroe))

## v2.12.5

[compare changes](https://github.com/nitrojs/nitro/compare/v2.12.4...v2.12.5)

### 🩹 Fixes

- **vercel:** Rename main function to `__fallback` ([4b28c706](https://github.com/nitrojs/nitro/commit/4b28c706))
- **vercel:** Prefix o11y routes with baseURL ([5c58de9b](https://github.com/nitrojs/nitro/commit/5c58de9b))
- Allow accessing vfs through unix socket ([#3533](https://github.com/nitrojs/nitro/pull/3533))
- **cloudflare-module:** Output _headers file to correct directory ([#3517](https://github.com/nitrojs/nitro/pull/3517))
- **bun:** Respect `HOST` and `NITRO_HOST` ([#3547](https://github.com/nitrojs/nitro/pull/3547))

### 💅 Refactors

- **vercel:** Rename `__nitro` function to `__fallback` ([#3502](https://github.com/nitrojs/nitro/pull/3502))
- **vercel:** Update function config types ([#3505](https://github.com/nitrojs/nitro/pull/3505))
- **cloudflare:** Update node-compat ([#3558](https://github.com/nitrojs/nitro/pull/3558))

### 📖 Documentation

- **vercel:** Minor improvements ([#3498](https://github.com/nitrojs/nitro/pull/3498))
- Add favicon.ico ([8124fbca](https://github.com/nitrojs/nitro/commit/8124fbca))
- Deprecate edgio preset ([#3509](https://github.com/nitrojs/nitro/pull/3509))

### 📦 Build

- Remove `@netlify/functions` dep ([#3556](https://github.com/nitrojs/nitro/pull/3556))
- Update node engine to `^20.19.0 ([](https://github.com/nitrojs/nitro/commit/))

### 🏡 Chore

- **release:** V2.12.4 ([ef6ae541](https://github.com/nitrojs/nitro/commit/ef6ae541))
- Update test ([8f638b14](https://github.com/nitrojs/nitro/commit/8f638b14))
- Update unenv ([5124f00d](https://github.com/nitrojs/nitro/commit/5124f00d))
- Update deps ([087221f3](https://github.com/nitrojs/nitro/commit/087221f3))
- Update `@vercel/nft` to 0.30 ([97ff9d5e](https://github.com/nitrojs/nitro/commit/97ff9d5e))
- Fix internal type issue ([c6ebcc65](https://github.com/nitrojs/nitro/commit/c6ebcc65))
- Update deps ([9bf29d59](https://github.com/nitrojs/nitro/commit/9bf29d59))
- Update deps ([d440f6b0](https://github.com/nitrojs/nitro/commit/d440f6b0))
- Update `pretty-bytes` and `unplugin-utils` ([d847547f](https://github.com/nitrojs/nitro/commit/d847547f))
- Update lockfile ([3e38b004](https://github.com/nitrojs/nitro/commit/3e38b004))
- Update deps ([0dd4f842](https://github.com/nitrojs/nitro/commit/0dd4f842))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))
-  >=22.12.0` (#3557) <a12449e1>
- MrlingXD ([@wling-art](https://github.com/wling-art))
- Adam DeHaven ([@adamdehaven](https://github.com/adamdehaven))
- Julien Huang ([@huang-julien](https://github.com/huang-julien))
- Luke Nelson <luke@nelson.zone>
- Anthony Shew <anthonyshew@gmail.com>

## v2.12.4

[compare changes](https://github.com/nitrojs/nitro/compare/v2.12.3...v2.12.4)

### 🩹 Fixes

- **vercel:** Valid regex for o11y routes ([#3500](https://github.com/nitrojs/nitro/pull/3500))

### ❤️ Contributors

- Pooya Parsa <pyapar@gmail.com>

## v2.12.3

[compare changes](https://github.com/nitrojs/nitro/compare/v2.12.2...v2.12.3)

### 🩹 Fixes

- **config:** Fallback to `nitro-dev` for older compatibility dates ([#3487](https://github.com/nitrojs/nitro/pull/3487))
- Store `nitro.json` commands relative to output dir ([#3492](https://github.com/nitrojs/nitro/pull/3492))
- **cloudflare:** Lowercase auto generated worker name ([#3490](https://github.com/nitrojs/nitro/pull/3490))

### ❤️ Contributors

- Falestio Hanif ([@Falestio](https://github.com/Falestio))
- Pooya Parsa <pyapar@gmail.com>

## v2.12.2

[compare changes](https://github.com/nitrojs/nitro/compare/v2.12.1...v2.12.2)

### 🩹 Fixes

- **cloudflare, aws-lambda:** Optional access to options ([#3482](https://github.com/nitrojs/nitro/pull/3482))

### 🏡 Chore

- **release:** V2.12.1 ([4210e9da](https://github.com/nitrojs/nitro/commit/4210e9da))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))

## v2.12.1

[compare changes](https://github.com/nitrojs/nitro/compare/65e514d873da1d1d9edd4d9576d48d90b13e0fac...v2.12.1)

### 🩹 Fixes

- **build:** Resolve `deploy` and `preview` commands ([#3481](https://github.com/nitrojs/nitro/pull/3481))

### 🏡 Chore

- Update changelog ([1241a92c](https://github.com/nitrojs/nitro/commit/1241a92c))
- Add playground to workspace ([a1b3b1bf](https://github.com/nitrojs/nitro/commit/a1b3b1bf))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))

## v2.12.0

See [Github Release Notes](https://github.com/nitrojs/nitro/releases/tag/v2.12.0).

## v2.11.13

[compare changes](https://github.com/nitrojs/nitro/compare/v2.11.12...v2.11.13)

### 🩹 Fixes

- **types:** Resolve absolute paths for type imports ([#3368](https://github.com/nitrojs/nitro/pull/3368))
- **cloudflare:** Globally polyfill env ([#3401](https://github.com/nitrojs/nitro/pull/3401))
- **dev:** Only use build dir for output ([#3413](https://github.com/nitrojs/nitro/pull/3413))
- **rollup:** Ensure that external dependency files have write permission ([#3419](https://github.com/nitrojs/nitro/pull/3419))
- **types:** Enable `skipLibCheck` by default ([#3373](https://github.com/nitrojs/nitro/pull/3373))

### 💅 Refactors

- Depend on unenv polyfill for `global` ([#3364](https://github.com/nitrojs/nitro/pull/3364))
- Add `tsConfig` to `types:extend` hook ([#3399](https://github.com/nitrojs/nitro/pull/3399))
- Update unenv and node compat ([#3421](https://github.com/nitrojs/nitro/pull/3421))

### 📖 Documentation

- Fix typo ([#3415](https://github.com/nitrojs/nitro/pull/3415))
- **database:** Fix example ([#3395](https://github.com/nitrojs/nitro/pull/3395))

### 🏡 Chore

- Update dependencies ([017c7436](https://github.com/nitrojs/nitro/commit/017c7436))
- Fix lint issue ([046a8c29](https://github.com/nitrojs/nitro/commit/046a8c29))
- Fix type issues ([bb627052](https://github.com/nitrojs/nitro/commit/bb627052))

### ✅ Tests

- Update tls test endpoint ([e680f420](https://github.com/nitrojs/nitro/commit/e680f420))
- Bypass tls test for deno and bun ([6da3d458](https://github.com/nitrojs/nitro/commit/6da3d458))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))
- Restent Ou ([@gxres042](https://github.com/gxres042))
- ChunyuPCY ([@ChunyuPCY](https://github.com/ChunyuPCY))
- Nagaakihoshi <nagaaki.hoshi@yourmystar.jp>
- Clément Guillot <guillot.clement@pm.me>
- Daniel Roe ([@danielroe](https://github.com/danielroe))
- Jonas Thelemann <e-mail@jonas-thelemann.de>

## v2.11.12

[compare changes](https://github.com/nitrojs/nitro/compare/v2.11.11...v2.11.12)

### 🩹 Fixes

- **dynamic-require:** Update regexp for new webpack import pattern ([#3339](https://github.com/nitrojs/nitro/pull/3339))
- **aws-lambda-streaming:** Handle undefined response body ([#3346](https://github.com/nitrojs/nitro/pull/3346))
- Scan handlers when initialising nitro ([6e1e4f7d](https://github.com/nitrojs/nitro/commit/6e1e4f7d))

### 💅 Refactors

- Better error for scanned dirs being a file ([#3342](https://github.com/nitrojs/nitro/pull/3342))

### 📖 Documentation

- **cloudflare:** Add `deployConfig` and prefer modules ([#3259](https://github.com/nitrojs/nitro/pull/3259))
- Add `workspaceDir` config option ([#3347](https://github.com/nitrojs/nitro/pull/3347))

### 🏡 Chore

- Update deps ([11524d28](https://github.com/nitrojs/nitro/commit/11524d28))

### ❤️ Contributors

- David Mo <david@dmo.ooo>
- Emily-shen ([@emily-shen](https://github.com/emily-shen))
- Restent Ou ([@gxres042](https://github.com/gxres042))
- Kasparas Galdikas ([@Kasparas-G55](https://github.com/Kasparas-G55))
- Pooya Parsa ([@pi0](https://github.com/pi0))
- McKittrick Kaminski ([@mckamyk](https://github.com/mckamyk))
- Daniel Roe ([@danielroe](https://github.com/danielroe))

## v2.11.11

[compare changes](https://github.com/nitrojs/nitro/compare/v2.11.10...v2.11.11)

### 🩹 Fixes

- **static:** Remove id from 404 `statusMessage` ([#3338](https://github.com/nitrojs/nitro/pull/3338))

### ❤️ Contributors

- Pooya Parsa <pyapar@gmail.com>

## v2.11.10

[compare changes](https://github.com/nitrojs/nitro/compare/4c634e7e4660eb7cc6e2b9c34d809e0e93a327f6...v2.11.10)

### 🩹 Fixes

- **open-api:** Load virtual files from rollup rather than fs ([#3324](https://github.com/nitrojs/nitro/pull/3324))
- **netlify-edge:** Enable function caching ([#3321](https://github.com/nitrojs/nitro/pull/3321))
- Inherit `context._platform` for direct fetch ([#3336](https://github.com/nitrojs/nitro/pull/3336))

### 💅 Refactors

- **cloudflare-durable:** Expose `publish` from durable object ([#3305](https://github.com/nitrojs/nitro/pull/3305))

### 📖 Documentation

- Correct example paths for  `serverAssets` option ([#3315](https://github.com/nitrojs/nitro/pull/3315))
- **azure:** Build command missing `run` ([#3313](https://github.com/nitrojs/nitro/pull/3313))

### 🏡 Chore

- Update deps ([ffb69deb](https://github.com/nitrojs/nitro/commit/ffb69deb))
- Update lockfile ([64588c59](https://github.com/nitrojs/nitro/commit/64588c59))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))
- Thibault Vlacich <thibault.vlacich@gmail.com>
- Luis Peralta <luis.peralta@gmail.com>
- Daniel Roe ([@danielroe](https://github.com/danielroe))
- Balázs Németh ([@zsilbi](https://github.com/zsilbi))

## v2.11.9

[compare changes](https://github.com/nitrojs/nitro/compare/v2.11.8...v2.11.9)

### 🩹 Fixes

- **cludflare-module:** Respect `baseURL` for public output assets ([#3280](https://github.com/nitrojs/nitro/pull/3280))
- **cludflare-module:** Remove baseURL prefix from deploy config dir ([#3283](https://github.com/nitrojs/nitro/pull/3283))
- Add unenv aliases for `process/` and `string_decoder/` ([#3273](https://github.com/nitrojs/nitro/pull/3273))

### 💅 Refactors

- **openapi:** Allow extensible `x-` properties in `$globals` ([#3278](https://github.com/nitrojs/nitro/pull/3278))
- Allow setting `dotenv` config for `loadOptions` ([#3274](https://github.com/nitrojs/nitro/pull/3274))
- **cloudflare:** Detect workers build ci ([#3279](https://github.com/nitrojs/nitro/pull/3279))
- **cloudflare:** Enable node compat and deploy config progressively on new workers CI ([#3284](https://github.com/nitrojs/nitro/pull/3284))
- Soft warning for compatibility date ([#3292](https://github.com/nitrojs/nitro/pull/3292))
- **cloudflare, deno-deploy:** Update node compat ([#3301](https://github.com/nitrojs/nitro/pull/3301))
- **dev:** Update serve-static to v2 ([#3302](https://github.com/nitrojs/nitro/pull/3302))

### 📖 Documentation

- Add compatibility date info ([#3290](https://github.com/nitrojs/nitro/pull/3290))

### 🏡 Chore

- Update minor deps ([bfcf48d1](https://github.com/nitrojs/nitro/commit/bfcf48d1))
- Update lockfile ([b8f86ef9](https://github.com/nitrojs/nitro/commit/b8f86ef9))
- Update deps ([1e629eba](https://github.com/nitrojs/nitro/commit/1e629eba))
- Update automd setup ([a5f24636](https://github.com/nitrojs/nitro/commit/a5f24636))
- Update unimport to v5 ([8d607960](https://github.com/nitrojs/nitro/commit/8d607960))
- Update deps ([a01d4e4f](https://github.com/nitrojs/nitro/commit/a01d4e4f))
- **aws-lambda:** Update types ([ba8a099d](https://github.com/nitrojs/nitro/commit/ba8a099d))
- Update lockfile ([7dde1094](https://github.com/nitrojs/nitro/commit/7dde1094))
- Update playground ([7a9efb8c](https://github.com/nitrojs/nitro/commit/7a9efb8c))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))
- Felix Gabler <felix.gabler98@gmail.com>
- Daniel Roe ([@danielroe](https://github.com/danielroe))
- Mukund Shah ([@mukundshah](https://github.com/mukundshah))

## v2.11.8

[compare changes](https://github.com/nitrojs/nitro/compare/v2.11.7...v2.11.8)

### 🩹 Fixes

- **dev:** Conditionally set headers for error handler ([#3249](https://github.com/nitrojs/nitro/pull/3249))
- **aws-lambda:** Aws-lambda-streaming set-cookie headers ([#3236](https://github.com/nitrojs/nitro/pull/3236))
- **config:** Resolve `srcDir` relative to `rootDir` ([#3250](https://github.com/nitrojs/nitro/pull/3250))

### 📦 Build

- Inline openapi-typescript types ([#3252](https://github.com/nitrojs/nitro/pull/3252))

### ❤️ Contributors

- Pooya Parsa <pyapar@gmail.com>
- McKittrick Kaminski ([@mckamyk](https://github.com/mckamyk))

## v2.11.7

[compare changes](https://github.com/nitrojs/nitro/compare/v2.11.6...v2.11.7)

### 🩹 Fixes

- **app:** Import user code last to avoid initialization order issues ([#3226](https://github.com/nitrojs/nitro/pull/3226))
- Only inherit `waitUntil` and platform context in fetch ([#3224](https://github.com/nitrojs/nitro/pull/3224))
- **dev:** Always throw proxy errors ([#3229](https://github.com/nitrojs/nitro/pull/3229))

### 💅 Refactors

- Update internal hash utils order ([#3227](https://github.com/nitrojs/nitro/pull/3227))
- Update scalar types ([10c8e534](https://github.com/nitrojs/nitro/commit/10c8e534))
- **cloudflare:** Update node.js compatibility ([#3230](https://github.com/nitrojs/nitro/pull/3230))
- **netlify-edge:** Update node.js compatibility ([#3231](https://github.com/nitrojs/nitro/pull/3231))

### 📖 Documentation

- **deno-server:** Add `compatibilityDate` note ([#3190](https://github.com/nitrojs/nitro/pull/3190))
- **netlify:** Add `compatibilityDate` note ([#3189](https://github.com/nitrojs/nitro/pull/3189))
- Updated callout ([#3219](https://github.com/nitrojs/nitro/pull/3219))
- **firebase:** Add firebase-app-hosting ([#3217](https://github.com/nitrojs/nitro/pull/3217))
- Use `server/` dir ([#2775](https://github.com/nitrojs/nitro/pull/2775))

### 🏡 Chore

- Update readme and ci scripts ([350d7998](https://github.com/nitrojs/nitro/commit/350d7998))
- Update readme ([c17d18c6](https://github.com/nitrojs/nitro/commit/c17d18c6))
- Update dependencies ([c24f39c2](https://github.com/nitrojs/nitro/commit/c24f39c2))
- Remove unused dependencies ([ff9c4f08](https://github.com/nitrojs/nitro/commit/ff9c4f08))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))
- Gerome Grignon ([@geromegrignon](https://github.com/geromegrignon))
- Yuangwang <yuangwang2@gmail.com>
- Ollie W ([@ollie-bud](https://github.com/ollie-bud))
- Restent Ou ([@gxres042](https://github.com/gxres042))

## v2.11.6

[compare changes](https://github.com/nitrojs/nitro/compare/v2.11.5...v2.11.6)

### 🩹 Fixes

- Update enenv and cloudflare node compat ([#3187](https://github.com/nitrojs/nitro/pull/3187))
- **dev:** Use port for bun on windows ([#3188](https://github.com/nitrojs/nitro/pull/3188))

### 💅 Refactors

- Remove extra space in logs ([#3181](https://github.com/nitrojs/nitro/pull/3181))
- Remove dependency on unenv mock utils ([#3186](https://github.com/nitrojs/nitro/pull/3186))

### 📖 Documentation

- **deploy:** Add warning about turborepo and zero config ([#3182](https://github.com/nitrojs/nitro/pull/3182))
- **vercel:** Typo ([#3183](https://github.com/nitrojs/nitro/pull/3183))
- **fetch:** Fix grammar ([#3184](https://github.com/nitrojs/nitro/pull/3184))

### 🏡 Chore

- **release:** V2.11.5 ([8099ed86](https://github.com/nitrojs/nitro/commit/8099ed86))
- Remove unused file ([8de0e8f3](https://github.com/nitrojs/nitro/commit/8de0e8f3))
- Update minor dependencies and lock ([75d0d826](https://github.com/nitrojs/nitro/commit/75d0d826))
- Update lock ([c2f8d066](https://github.com/nitrojs/nitro/commit/c2f8d066))
- Update unenv ([b26d2b5a](https://github.com/nitrojs/nitro/commit/b26d2b5a))

### ✅ Tests

- Update cloudflare-module ([0f3e4a3b](https://github.com/nitrojs/nitro/commit/0f3e4a3b))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))
- Nandesora Tjihero ([@Ombuweb](https://github.com/Ombuweb))
- @beer ([@iiio2](https://github.com/iiio2))
- Connor Roberts ([@murshex](https://github.com/murshex))
- Restent Ou ([@gxres042](https://github.com/gxres042))

## v2.11.5

[compare changes](https://github.com/nitrojs/nitro/compare/v2.11.4...v2.11.5)

### 🩹 Fixes

- **dev:** Use abstract sockets on linux with node.js >=20 ([#3178](https://github.com/nitrojs/nitro/pull/3178))
- **dev:** Use os tmp dir for unix sockets ([#3179](https://github.com/nitrojs/nitro/pull/3179))

### 📦 Build

- Use upstream `youch` back ([#3175](https://github.com/nitrojs/nitro/pull/3175))

### 🌊 Types

- Mark `$global` optional for `NitroRouteMeta` ([#3174](https://github.com/nitrojs/nitro/pull/3174))

### ❤️ Contributors

- Pooya Parsa <pyapar@gmail.com>
- Léo Pradel <pradel.leo@gmail.com>

## v2.11.4

[compare changes](https://github.com/nitrojs/nitro/compare/v2.11.3...v2.11.4)

### 🩹 Fixes

- **dev:** Auto fallback to port if socket listening failed ([#3165](https://github.com/nitrojs/nitro/pull/3165))
- **dev:** Polyfill `globalThis.crypto` for Node.js 18 ([#3166](https://github.com/nitrojs/nitro/pull/3166))
- **cli:** Add `globalThis.crypto` polyfill for Node.js 18 ([#3167](https://github.com/nitrojs/nitro/pull/3167))
- **dev:** Polyfill `globalThis.crypto` for Node.js 18 ([#3168](https://github.com/nitrojs/nitro/pull/3168))
- **dev:** Try normal socket for CI ([a4569493](https://github.com/nitrojs/nitro/commit/a4569493))

### 📦 Build

- Inline youch dependency ([#3169](https://github.com/nitrojs/nitro/pull/3169))
- Use `youch-redist` ([#3172](https://github.com/nitrojs/nitro/pull/3172))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))

## v2.11.3

[compare changes](https://github.com/nitrojs/nitro/compare/v2.11.2...v2.11.3)

### 🩹 Fixes

- **cloudflare:** Support `wrangler.jsonc` ([#3162](https://github.com/nitrojs/nitro/pull/3162))

### 💅 Refactors

- Expose default error to custom handler ([#3161](https://github.com/nitrojs/nitro/pull/3161))
- **dev:** Only show force close warn in debug mode ([06147e7a](https://github.com/nitrojs/nitro/commit/06147e7a))

### 🏡 Chore

- **release:** V2.11.2 ([e21ce69d](https://github.com/nitrojs/nitro/commit/e21ce69d))
- Update devcontainer config ([92f1a37a](https://github.com/nitrojs/nitro/commit/92f1a37a))
- Lowercase header ([e3866d04](https://github.com/nitrojs/nitro/commit/e3866d04))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))

## v2.11.2

[compare changes](https://github.com/nitrojs/nitro/compare/v2.11.1...v2.11.2)

### 🩹 Fixes

- **prerender:** Ignore prefixed public assets ([#3093](https://github.com/nitrojs/nitro/pull/3093))
- **dev:** Mark event as handled before sending proxy ([058819aa](https://github.com/nitrojs/nitro/commit/058819aa))
- **dev:** Force close server immediately in test and ci ([97ed879a](https://github.com/nitrojs/nitro/commit/97ed879a))
- **dev:** Close all connections when reloading ([5b5e10e7](https://github.com/nitrojs/nitro/commit/5b5e10e7))
- **config:** Respect config overrides for defaults ([#3158](https://github.com/nitrojs/nitro/pull/3158))

### 💅 Refactors

- Move handled set to proxy util ([67c396ba](https://github.com/nitrojs/nitro/commit/67c396ba))

### 🏡 Chore

- **release:** V2.11.1 ([cd3b8724](https://github.com/nitrojs/nitro/commit/cd3b8724))
- Update deps ([53da847b](https://github.com/nitrojs/nitro/commit/53da847b))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))
- Daniel Roe ([@danielroe](https://github.com/danielroe))

## v2.11.1

[compare changes](https://github.com/nitrojs/nitro/compare/v2.11.0...v2.11.1)

### 🩹 Fixes

- **dev:** Use full socket path for windows and linux ([#3152](https://github.com/nitrojs/nitro/pull/3152))
- **dev:** Add random number to socket name ([#3153](https://github.com/nitrojs/nitro/pull/3153))
- **dev:** Limit `/_vfs` to local ips only ([#3154](https://github.com/nitrojs/nitro/pull/3154))
- **app:** Update `event` before calling `request` hook ([#3155](https://github.com/nitrojs/nitro/pull/3155))

### ❤️ Contributors

- Balázs Németh ([@zsilbi](https://github.com/zsilbi))
- Pooya Parsa <pyapar@gmail.com>

## v2.11.0

Check [release notes](https://github.com/nitrojs/nitro/releases/tag/v2.11.0)

## v2.10.4

[compare changes](https://github.com/nitrojs/nitro/compare/v2.10.3...v2.10.4)

### 🔥 Performance

- **raw:** Avoid extra `this.resolve` when possible ([#2857](https://github.com/nitrojs/nitro/pull/2857))

### 📖 Documentation

- **config:** Tiny typos ([#2859](https://github.com/nitrojs/nitro/pull/2859))

### 🏡 Chore

- Remove extra `NODE_OPTIONS` from scripts ([50ff48a6](https://github.com/nitrojs/nitro/commit/50ff48a6))
- Update ci script ([f9c269fb](https://github.com/nitrojs/nitro/commit/f9c269fb))

### ✅ Tests

- Add tests for #2838, #2836 ([#2838](https://github.com/nitrojs/nitro/issues/2838), [#2836](https://github.com/nitrojs/nitro/issues/2836))
- Fix windows issue ([924eaa52](https://github.com/nitrojs/nitro/commit/924eaa52))
- Enable dev tests on ci ([#2858](https://github.com/nitrojs/nitro/pull/2858))

### ❤️ Contributors

- @beer ([@iiio2](http://github.com/iiio2))
- Pooya Parsa ([@pi0](http://github.com/pi0))
- Arkadiusz Sygulski <arkadiusz@sygulski.pl>

## v2.10.3

[compare changes](https://github.com/nitrojs/nitro/compare/v2.10.2...v2.10.3)

### 🩹 Fixes

- Allow adding custom `Vary` to static assets handler ([#2835](https://github.com/nitrojs/nitro/pull/2835))
- **netlify:** Only include env polyfill in `netlify-edge` ([#2851](https://github.com/nitrojs/nitro/pull/2851))
- Scan env specific handlers without method in their name ([#2852](https://github.com/nitrojs/nitro/pull/2852))
- **config:** Add back default storage mounts ([#2853](https://github.com/nitrojs/nitro/pull/2853))

### 📖 Documentation

- **cloudflare:** Fix typo ([#2849](https://github.com/nitrojs/nitro/pull/2849))

### 🌊 Types

- **cache:** Resolved value is not nullable ([#2848](https://github.com/nitrojs/nitro/pull/2848))

### ❤️ Contributors

- Pooya Parsa <pyapar@gmail.com>
- Sandro Circi ([@sandros94](http://github.com/sandros94))
- Jaga Santagostino <jagasantagostino@gmail.com>
- Philippe Serhal <philippe.serhal@netlify.com>
- Danila Rodichkin ([@daniluk4000](http://github.com/daniluk4000))

## v2.10.2

[compare changes](https://github.com/nitrojs/nitro/compare/v2.10.1...v2.10.2)

### 🩹 Fixes

- **rollup:** Pass options to `resolve` ([#2842](https://github.com/nitrojs/nitro/pull/2842))

### 📖 Documentation

- **cloudflare:** Update `cloudflare-module` ([#2831](https://github.com/nitrojs/nitro/pull/2831))
- Update nightly and experimental banners ([9ff37139](https://github.com/nitrojs/nitro/commit/9ff37139))

### ❤️ Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))
- Restent Ou ([@gxres042](http://github.com/gxres042))

## v2.10.1

[compare changes](https://github.com/nitrojs/nitro/compare/v2.10.0...v2.10.1)

### 🩹 Fixes

- **imports:** Use explicit import for `useDatabase` ([#2837](https://github.com/nitrojs/nitro/pull/2837))
- **rollup:** Check raw extensions against resolved id ([#2838](https://github.com/nitrojs/nitro/pull/2838))
- **imports:** Use explicit imports ([#2839](https://github.com/nitrojs/nitro/pull/2839))
- Update `node_cluster` entry name ([#2840](https://github.com/nitrojs/nitro/pull/2840))

### ❤️ Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))

## v2.10.0

[compare changes](https://github.com/nitrojs/nitro/compare/v2.9.6...v2.10.0)

### 🚀 Enhancements

- Generate types for runtime config ([#2306](https://github.com/nitrojs/nitro/pull/2306))
- **serverAssets:** Support `ignore` option ([#2302](https://github.com/nitrojs/nitro/pull/2302))
- Expose `getRouteRulesForPath` from nitro runtime ([#2238](https://github.com/nitrojs/nitro/pull/2238))
- **openapi:** Support configuration via `openapi` ([#2299](https://github.com/nitrojs/nitro/pull/2299))
- Environment specific event handlers ([#2272](https://github.com/nitrojs/nitro/pull/2272))
- Experimental `defineRouteMeta` ([#2102](https://github.com/nitrojs/nitro/pull/2102))
- **cloudflare-pages:** Generate `wrangler.toml` ([#2353](https://github.com/nitrojs/nitro/pull/2353))
- Allow customizing `apiBaseURL`, `apiDir` and `routesDir` ([#1763](https://github.com/nitrojs/nitro/pull/1763))
- **aws-lambda:** Experimental streaming support ([#2412](https://github.com/nitrojs/nitro/pull/2412))
- **providers:** Add `gitlab-pages` static provider ([#2420](https://github.com/nitrojs/nitro/pull/2420))
- **netlify:** Experimental support v2 functions ISR via targeted cache-control headers ([#2406](https://github.com/nitrojs/nitro/pull/2406))
- Add compatibility date support ([#2511](https://github.com/nitrojs/nitro/pull/2511))
- **cloudflare-module:** Support `cloudflare:email` and `cloudflare:queue` hooks ([#2487](https://github.com/nitrojs/nitro/pull/2487))
- **defineCachedEventHandler:** Add `event.context.cache` ([#2519](https://github.com/nitrojs/nitro/pull/2519))
- **core:** Warn if runtime config is not serializable ([#2542](https://github.com/nitrojs/nitro/pull/2542))
- **netlify:** Use new `durable` cache-control directive for `isr` rule ([#2571](https://github.com/nitrojs/nitro/pull/2571))
- **open-api:** Production mode ([#2570](https://github.com/nitrojs/nitro/pull/2570))
- **deno-server:** Use output `node_modules` for `start` task ([#2687](https://github.com/nitrojs/nitro/pull/2687))
- Add genezio preset ([#2637](https://github.com/nitrojs/nitro/pull/2637))
- Add zerops preset ([#2698](https://github.com/nitrojs/nitro/pull/2698))
- **dev-server:** Redirect requsts without base url ([#2713](https://github.com/nitrojs/nitro/pull/2713))
- **firebase:** Upgrade default runtime to node 20 ([#2654](https://github.com/nitrojs/nitro/pull/2654))
- Upgrade to jiti v2 ([#2742](https://github.com/nitrojs/nitro/pull/2742))
- **raw:** Add `.sql` to raw file extensions ([#2745](https://github.com/nitrojs/nitro/pull/2745))
- **scan:** Route groups ([#2664](https://github.com/nitrojs/nitro/pull/2664))
- **renderer:** Add `render:before` hook ([#2770](https://github.com/nitrojs/nitro/pull/2770))
- Add pdf and wasm to compressible mime types ([#2766](https://github.com/nitrojs/nitro/pull/2766))
- **ws:** Upgrade crossws to 0.3.x ([#2776](https://github.com/nitrojs/nitro/pull/2776))
- **vercel:** Allow fine-grained isr config via route rules ([#2780](https://github.com/nitrojs/nitro/pull/2780))
- Update db0 to v0.2 ([3d5216be](https://github.com/nitrojs/nitro/commit/3d5216be))
- **cloudflare-module:** Expose all handlers as runtime hooks ([#2795](https://github.com/nitrojs/nitro/pull/2795))
- **cloudflare-module:** Use new workers static assets ([#2800](https://github.com/nitrojs/nitro/pull/2800))
- Experimental `cloudflare-durable` preset ([#2801](https://github.com/nitrojs/nitro/pull/2801))
- **aws-lambda:** Add streaming support to main preset ([#2786](https://github.com/nitrojs/nitro/pull/2786))
- Include preset config in `.output/nitro.json` ([#2807](https://github.com/nitrojs/nitro/pull/2807))
- **cache:** Set `ttl` for native expiration (with swr disabled) ([#2783](https://github.com/nitrojs/nitro/pull/2783))

### 🔥 Performance

- Limit open files in generateFSTree ([#2458](https://github.com/nitrojs/nitro/pull/2458))
- **netlify-legacy:** Exclude static paths from server handler ([#2823](https://github.com/nitrojs/nitro/pull/2823))
- **netlify, netlify-edge:** Exclude static paths from server handler ([#2822](https://github.com/nitrojs/nitro/pull/2822))

### 🩹 Fixes

- **github-pages:** Prerender `/` by default ([#2334](https://github.com/nitrojs/nitro/pull/2334))
- **deno-server:** Always inject `process` from `node:process` ([#2372](https://github.com/nitrojs/nitro/pull/2372))
- **deno-server:** Explicitly remove cert/key from options if either is not set ([#2373](https://github.com/nitrojs/nitro/pull/2373))
- Deduplicate plugins ([#2391](https://github.com/nitrojs/nitro/pull/2391))
- **iis:** Deep merge configs ([#2358](https://github.com/nitrojs/nitro/pull/2358))
- **externals:** Compare package paths against normalized `id` ([#2371](https://github.com/nitrojs/nitro/pull/2371))
- **azure:** Correctly handle `maxAge` cookie option ([#2400](https://github.com/nitrojs/nitro/pull/2400))
- Add `.tsx` and `.jsx` to `node-resolve` extensions ([#2398](https://github.com/nitrojs/nitro/pull/2398))
- Lower-case accepted handler method ([#2382](https://github.com/nitrojs/nitro/pull/2382))
- Set `compilerOptions.noEmit` to avoid `tsconfig.json` warning ([#2402](https://github.com/nitrojs/nitro/pull/2402))
- **prerender:** Only try to add `/` after `prerender:routes` hook ([#2348](https://github.com/nitrojs/nitro/pull/2348))
- **azure:** Correctly handle maxAge cookie option ([#2403](https://github.com/nitrojs/nitro/pull/2403))
- **aws-lambda-streaming:** Fix global lambda import pointing to wrong ([#2422](https://github.com/nitrojs/nitro/pull/2422))
- **netlify:** Match ISR route rules when path has a query string ([#2440](https://github.com/nitrojs/nitro/pull/2440))
- **preset-iis:** Parse without  `explicitArray` to allow merging `web.config` ([#2457](https://github.com/nitrojs/nitro/pull/2457))
- Pass custom entry filename when resolving prerenderer ([#2461](https://github.com/nitrojs/nitro/pull/2461))
- **vercel:** Support custom `baseURL` ([#2464](https://github.com/nitrojs/nitro/pull/2464))
- Use relative paths in `nitro-config.d.ts` ([#2471](https://github.com/nitrojs/nitro/pull/2471))
- **netlify:** Added missing quotes in utils ([#2472](https://github.com/nitrojs/nitro/pull/2472))
- Avoid named exports from `package.json` ([e6097ed7](https://github.com/nitrojs/nitro/commit/e6097ed7))
- **cloudflare-pages:** Remove `.html` extension from `_routes.json` ([#2498](https://github.com/nitrojs/nitro/pull/2498))
- More compatibility for import from `nitropack/runtime/*` ([#2501](https://github.com/nitrojs/nitro/pull/2501))
- **build:** Correctly watch custom `apiDir` and `routesDir` ([#2502](https://github.com/nitrojs/nitro/pull/2502))
- **public-assets:** Do not shadow paths that share prefix ([#2516](https://github.com/nitrojs/nitro/pull/2516))
- **core:** Resolve modules with esm compatibility ([#2514](https://github.com/nitrojs/nitro/pull/2514))
- **prerender:** Extract links from explicit html routes ([#2517](https://github.com/nitrojs/nitro/pull/2517))
- Upate `cli` preset with esm module format ([#2539](https://github.com/nitrojs/nitro/pull/2539))
- Make sure nitro runtime goes to one chunk ([#2547](https://github.com/nitrojs/nitro/pull/2547))
- **types:** Infer types correctly when method is omitted ([#2551](https://github.com/nitrojs/nitro/pull/2551))
- **renderer:** Check full path for `/favicon.ico` placeholder ([#2553](https://github.com/nitrojs/nitro/pull/2553))
- **netlify:** Ensure preview command is correct ([#2561](https://github.com/nitrojs/nitro/pull/2561))
- Backward compatibility types for v2 ([#2563](https://github.com/nitrojs/nitro/pull/2563))
- **handler-meta:** Check for `.name` with `undefined`  value in `ObjectExpression` ([#2565](https://github.com/nitrojs/nitro/pull/2565))
- Hide unhandled error messages in prod ([#2591](https://github.com/nitrojs/nitro/pull/2591))
- **prerender:** Allow ignoring errors in `prerender:generate` hook ([#2610](https://github.com/nitrojs/nitro/pull/2610))
- Only hide message of unhandled errors in prod ([#2619](https://github.com/nitrojs/nitro/pull/2619))
- **prerender:** Skip protocol relative links ([#2661](https://github.com/nitrojs/nitro/pull/2661))
- Ensure legacy runtime config types are populated ([#2724](https://github.com/nitrojs/nitro/pull/2724))
- Ensure legacy hook types are populated ([#2725](https://github.com/nitrojs/nitro/pull/2725))
- Do not generate runtime config types with external framework ([#2732](https://github.com/nitrojs/nitro/pull/2732))
- **prerender:** Log error stack traces ([#2720](https://github.com/nitrojs/nitro/pull/2720))
- **cache:** Use top level `function` to avoid rollup chunk ordering issues ([#2741](https://github.com/nitrojs/nitro/pull/2741))
- **cli:** Respect custom `buildDir` option for `tasks` subcommand ([#2635](https://github.com/nitrojs/nitro/pull/2635))
- Initialize nitro app before plugins run ([#1906](https://github.com/nitrojs/nitro/pull/1906))
- **cloudflare-module:** Use correct types for email and queue events/hooks ([#2711](https://github.com/nitrojs/nitro/pull/2711))
- **azure-functions:** Follow symlinks in zip bundle ([#2769](https://github.com/nitrojs/nitro/pull/2769))
- Use jiti with `{ default: true }` for importing modules ([d77288c2](https://github.com/nitrojs/nitro/commit/d77288c2))
- **firebase:** Validate custom `serverFunctionName` ([#2773](https://github.com/nitrojs/nitro/pull/2773))
- Add `db0` and `std-env` to `runtimeDependencies` ([a399e189](https://github.com/nitrojs/nitro/commit/a399e189))
- **error:** Add `cache-control: no-cache` for 404 responses ([#2793](https://github.com/nitrojs/nitro/pull/2793))
- **renderer:** Check `ctx.response` ([7a97b0a2](https://github.com/nitrojs/nitro/commit/7a97b0a2))
- **cache:** Catch error when getting cache entry ([#2609](https://github.com/nitrojs/nitro/pull/2609), [#2820](https://github.com/nitrojs/nitro/pull/2820))
- **cache:** Try decode path ([#2658](https://github.com/nitrojs/nitro/pull/2658))
- **cloudflare:** Support custom `baseURL` ([#2821](https://github.com/nitrojs/nitro/pull/2821))
- Handle incompatible compatibility date for presets ([#2828](https://github.com/nitrojs/nitro/pull/2828))

### 💅 Refactors

- **openapi:** Update swagger-ui version to v5 for OpenAPI v3.1 support ([#2343](https://github.com/nitrojs/nitro/pull/2343))
- **cloudflare-pages:** Update root `wrangler.toml` in CI ([#2355](https://github.com/nitrojs/nitro/pull/2355))
- Strict typechecks ([#2370](https://github.com/nitrojs/nitro/pull/2370))
- Convert `CapturedErrorContext` to interface to allow type augmentation ([#2393](https://github.com/nitrojs/nitro/pull/2393))
- Overhaul presets structure ([#2446](https://github.com/nitrojs/nitro/pull/2446))
- Structure overhaul ([#2473](https://github.com/nitrojs/nitro/pull/2473))
- Remove dependency on `/runtime/internal/*` subpaths ([#2524](https://github.com/nitrojs/nitro/pull/2524))
- Migrate to `colors` from `consola/utils` ([#2574](https://github.com/nitrojs/nitro/pull/2574))
- Remove `fs-extra` dependency ([#2743](https://github.com/nitrojs/nitro/pull/2743))
- **cache:** Remove unnecessary nullish coalescing operator ([#2608](https://github.com/nitrojs/nitro/pull/2608))
- **dev:** Attach worker reload error as `cause` ([#2651](https://github.com/nitrojs/nitro/pull/2651))
- Improve type definitions for `CacheOptions` ([#2700](https://github.com/nitrojs/nitro/pull/2700))
- **cloudflare-module:** Extract reusable logic ([#2799](https://github.com/nitrojs/nitro/pull/2799))

### 📖 Documentation

- Remove duplicate option definition ([#2339](https://github.com/nitrojs/nitro/pull/2339))
- **fetch:** Unexpected spaces ([#2368](https://github.com/nitrojs/nitro/pull/2368))
- Correct env variable to `NITRO_SHUTDOWN_DISABLED` ([#2377](https://github.com/nitrojs/nitro/pull/2377))
- **caching:** Fix typos and rephrase for clarity ([#2380](https://github.com/nitrojs/nitro/pull/2380))
- Add a usage example for server sent events ([#2379](https://github.com/nitrojs/nitro/pull/2379))
- Correct directory name ([#2417](https://github.com/nitrojs/nitro/pull/2417))
- Use `npx nypm install` in instead of `npm install` ([#2421](https://github.com/nitrojs/nitro/pull/2421))
- **websocket:** Correct nuxt sse url ([#2430](https://github.com/nitrojs/nitro/pull/2430))
- **node:** Fix `node-listener` example ([#2456](https://github.com/nitrojs/nitro/pull/2456))
- Prefix `NITRO_` in `.env` file ([#2486](https://github.com/nitrojs/nitro/pull/2486))
- Fix typo autoSubFolderIndex ~> autoSubfolderIndex ([#2494](https://github.com/nitrojs/nitro/pull/2494))
- Correct h3 docs link to `event-handler` ([#2500](https://github.com/nitrojs/nitro/pull/2500))
- Move `await` to explicit line for clarity ([#2577](https://github.com/nitrojs/nitro/pull/2577))
- Fix typos ([#2578](https://github.com/nitrojs/nitro/pull/2578))
- Fix typos ([#2589](https://github.com/nitrojs/nitro/pull/2589))
- **storage:** Add await before `setItem` ([#2588](https://github.com/nitrojs/nitro/pull/2588))
- Convert to underscore preset names ([#2592](https://github.com/nitrojs/nitro/pull/2592))
- Fix title format ([#2594](https://github.com/nitrojs/nitro/pull/2594))
- **cloudflare:** Add missing `await` ([#2601](https://github.com/nitrojs/nitro/pull/2601))
- **compressPublicAssets:** Adjust formatting ([#2603](https://github.com/nitrojs/nitro/pull/2603))
- **routing:** Add nested example ([#2625](https://github.com/nitrojs/nitro/pull/2625))
- Fix mdc component usage and cloudflare preset reference ([#2600](https://github.com/nitrojs/nitro/pull/2600))
- Fix grammar ([#2669](https://github.com/nitrojs/nitro/pull/2669))
- **server routes:** Fix typo ([#2675](https://github.com/nitrojs/nitro/pull/2675))
- **utils:** Update github link ([#2596](https://github.com/nitrojs/nitro/pull/2596))
- **config:** Fix url for log level ([#2699](https://github.com/nitrojs/nitro/pull/2699))
- Remove old components ([fc6c2fae](https://github.com/nitrojs/nitro/commit/fc6c2fae))
- **config:** Fix typos ([#2728](https://github.com/nitrojs/nitro/pull/2728))
- **cache:** Fix code format ([#2740](https://github.com/nitrojs/nitro/pull/2740))
- **config:** Fix typo prerender retries -> retry ([#2746](https://github.com/nitrojs/nitro/pull/2746))
- `/_nitro/scalar` general availability ([#2754](https://github.com/nitrojs/nitro/pull/2754))
- Notice for OpenAPI paths changing in future versions ([#2755](https://github.com/nitrojs/nitro/pull/2755))
- **node:** Fix typo ([#2761](https://github.com/nitrojs/nitro/pull/2761))
- **routing:** Fix grammer ([#2763](https://github.com/nitrojs/nitro/pull/2763))
- **routing:** Add error handling section ([#2733](https://github.com/nitrojs/nitro/pull/2733))
- **tasks:** Fix grammar ([#2768](https://github.com/nitrojs/nitro/pull/2768))
- **server-utils:** Fix typos ([#2790](https://github.com/nitrojs/nitro/pull/2790))
- Update reference to old radix3 link ([#2787](https://github.com/nitrojs/nitro/pull/2787))
- **typescript:** Tiny typos ([#2805](https://github.com/nitrojs/nitro/pull/2805))
- **server-routes:** Typo ([#2808](https://github.com/nitrojs/nitro/pull/2808))
- Fix nitro runtime hooks link ([#2826](https://github.com/nitrojs/nitro/pull/2826))
- Use nitro.build as canonical ([78cd3e7b](https://github.com/nitrojs/nitro/commit/78cd3e7b))

### 📦 Build

- Explicitly add `nitropack` to externals (nightly) ([b2831dd5](https://github.com/nitrojs/nitro/commit/b2831dd5))
- Load presets from unbundled `nitropack/presets` ([#2459](https://github.com/nitrojs/nitro/pull/2459))
- Update unbuild to 3.x ([c95dae55](https://github.com/nitrojs/nitro/commit/c95dae55))
- Introduce `nitropack/meta` ([ca2282bb](https://github.com/nitrojs/nitro/commit/ca2282bb))
- Improve chunk names ([4106750c](https://github.com/nitrojs/nitro/commit/4106750c))
- Hotfix unbuild to resolve jiti stub await issue ([01128017](https://github.com/nitrojs/nitro/commit/01128017))
- Mirror `nitro` and `nitropack` npm packages ([#2497](https://github.com/nitrojs/nitro/pull/2497))

### 🌊 Types

- **firebase:** Support `22` for `nodeVersion` ([#2653](https://github.com/nitrojs/nitro/pull/2653))

### 🏡 Chore

- **release:** V2.9.6 ([6f159205](https://github.com/nitrojs/nitro/commit/6f159205))
- **docs:** Update lockfile ([7bfe4449](https://github.com/nitrojs/nitro/commit/7bfe4449))
- Update deps ([b444f173](https://github.com/nitrojs/nitro/commit/b444f173))
- Lint and migrate to eslint flat config ([#2352](https://github.com/nitrojs/nitro/pull/2352))
- **cf-pages:** Only create wrangler.toml if config is not empty ([#2356](https://github.com/nitrojs/nitro/pull/2356))
- Update deps ([8add14c7](https://github.com/nitrojs/nitro/commit/8add14c7))
- Fix typos ([#2386](https://github.com/nitrojs/nitro/pull/2386))
- Update eslint preset ([78ec24d1](https://github.com/nitrojs/nitro/commit/78ec24d1))
- Update deps ([ad100f49](https://github.com/nitrojs/nitro/commit/ad100f49))
- Format ([f95c4f53](https://github.com/nitrojs/nitro/commit/f95c4f53))
- Update lockfile ([a14b1532](https://github.com/nitrojs/nitro/commit/a14b1532))
- Disable flaky db test on windows ([ececd699](https://github.com/nitrojs/nitro/commit/ececd699))
- Update deps and lockfile ([9642ef6c](https://github.com/nitrojs/nitro/commit/9642ef6c))
- Update eslint and biome ([00097738](https://github.com/nitrojs/nitro/commit/00097738))
- Ignore biome formatting `package.json` ([fe5da142](https://github.com/nitrojs/nitro/commit/fe5da142))
- Update dependencies ([1fae1ce3](https://github.com/nitrojs/nitro/commit/1fae1ce3))
- Update `@rollup/plugin-commonjs` ([eeae2262](https://github.com/nitrojs/nitro/commit/eeae2262))
- Update `config.d.ts` ([0083c104](https://github.com/nitrojs/nitro/commit/0083c104))
- Add compatibilityDate to fixture ([ced80b21](https://github.com/nitrojs/nitro/commit/ced80b21))
- **playground:** Does not overwrite `tsconfig.paths` ([#2507](https://github.com/nitrojs/nitro/pull/2507))
- Add missing `magicast` dep ([c84f676d](https://github.com/nitrojs/nitro/commit/c84f676d))
- Update ci node version to 20 ([09c8267c](https://github.com/nitrojs/nitro/commit/09c8267c))
- Prepare v2 branch ([d549634e](https://github.com/nitrojs/nitro/commit/d549634e))
- Lint with biome ([#2525](https://github.com/nitrojs/nitro/pull/2525))
- Improve internal `tsconfig.json` ([#2529](https://github.com/nitrojs/nitro/pull/2529))
- Remove unused dependency `is-primitive` ([#2556](https://github.com/nitrojs/nitro/pull/2556))
- Fix typegen script ([a4abb222](https://github.com/nitrojs/nitro/commit/a4abb222))
- Remove extra space in banner ([#2573](https://github.com/nitrojs/nitro/pull/2573))
- Update deps and lockfile ([c7435f07](https://github.com/nitrojs/nitro/commit/c7435f07))
- Fix types ([2298d246](https://github.com/nitrojs/nitro/commit/2298d246))
- Update tests ([3594a189](https://github.com/nitrojs/nitro/commit/3594a189))
- Update undocs ([b37875ac](https://github.com/nitrojs/nitro/commit/b37875ac))
- Update undocs ([7d9619fd](https://github.com/nitrojs/nitro/commit/7d9619fd))
- Update non-major dependencies ([bb8c2071](https://github.com/nitrojs/nitro/commit/bb8c2071))
- Fix type issues ([2615d392](https://github.com/nitrojs/nitro/commit/2615d392))
- **renovate:** Ignore crossws ([95095fb3](https://github.com/nitrojs/nitro/commit/95095fb3))
- Update to jiti 2.0.0 ([cb3fe58d](https://github.com/nitrojs/nitro/commit/cb3fe58d))
- Update unbuild ([60502e4e](https://github.com/nitrojs/nitro/commit/60502e4e))
- Add `compatibilityDate` for playground ([2c404995](https://github.com/nitrojs/nitro/commit/2c404995))
- Update deps ([9092e2e2](https://github.com/nitrojs/nitro/commit/9092e2e2))
- Add codeowners file ([1709b16c](https://github.com/nitrojs/nitro/commit/1709b16c))
- Add `compatibilityDate` to all config files ([f70b03c6](https://github.com/nitrojs/nitro/commit/f70b03c6))
- Lint ([811511ef](https://github.com/nitrojs/nitro/commit/811511ef))
- Enable `interopDefault` for stub mode ([69b05a5e](https://github.com/nitrojs/nitro/commit/69b05a5e))
- Update undocs ([062a2214](https://github.com/nitrojs/nitro/commit/062a2214))
- Update jiti and deps ([817518bd](https://github.com/nitrojs/nitro/commit/817518bd))
- Update deps ([12d3723a](https://github.com/nitrojs/nitro/commit/12d3723a))
- Update deps ([e874c4ca](https://github.com/nitrojs/nitro/commit/e874c4ca))
- Update deps ([313eac90](https://github.com/nitrojs/nitro/commit/313eac90))
- **examples:** Clarify post handler ([#2781](https://github.com/nitrojs/nitro/pull/2781))
- Update deps ([92519e02](https://github.com/nitrojs/nitro/commit/92519e02))
- Update deps ([9d483939](https://github.com/nitrojs/nitro/commit/9d483939))
- **examples:** Provide `event` in `defineEventHandler` function ([#2788](https://github.com/nitrojs/nitro/pull/2788))
- **devcontainer:** Update node.js to v22 ([#2817](https://github.com/nitrojs/nitro/pull/2817))
- **examples:** Change name in package.json ([#2816](https://github.com/nitrojs/nitro/pull/2816))
- Update deps ([642c1009](https://github.com/nitrojs/nitro/commit/642c1009))
- Update croner to v9 ([cffb3cd4](https://github.com/nitrojs/nitro/commit/cffb3cd4))
- Remove unused `mri` dependency ([#2825](https://github.com/nitrojs/nitro/pull/2825))
- Update deps ([32a4f867](https://github.com/nitrojs/nitro/commit/32a4f867))
- Update nitro org ([9b02f572](https://github.com/nitrojs/nitro/commit/9b02f572))

### ✅ Tests

- Avoid `toMatchInlineSnapshot` in shared tests ([966b3518](https://github.com/nitrojs/nitro/commit/966b3518))

### 🎨 Styles

- Try biome formatter ([#2401](https://github.com/nitrojs/nitro/pull/2401))
- Use prettier ([710765ea](https://github.com/nitrojs/nitro/commit/710765ea))

### 🤖 CI

- Make nightly versions human readable ([37f0d4f4](https://github.com/nitrojs/nitro/commit/37f0d4f4))

### ❤️ Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))
- @beer ([@iiio2](http://github.com/iiio2))
- Alexander ([@hywax](http://github.com/hywax))
- Sébastien Chopin ([@atinux](http://github.com/atinux))
- Connor Pearson ([@cjpearson](http://github.com/cjpearson))
- Philippe Serhal <philippe.serhal@netlify.com>
- Dax <d@ironbay.co>
- Dawit ([@oneminch](http://github.com/oneminch))
- João Carmona ([@jpsc](http://github.com/jpsc))
- Aarvin Roshin <aarvinr@outlook.com>
- Jan-Henrik Damaschke <jdamaschke@outlook.de>
- Marvin ([@marvin-j97](http://github.com/marvin-j97))
- Timur ([@Rewwoken](http://github.com/Rewwoken))
- Horváth Bálint ([@horvbalint](http://github.com/horvbalint))
- Horu ([@HigherOrderLogic](http://github.com/HigherOrderLogic))
- Balázs Németh ([@zsilbi](http://github.com/zsilbi))
- Yoones Khoshghadam <yooneskh@gmail.com>
- Gautier Ben Aïm ([@GauBen](http://github.com/GauBen))
- Lionel Paulus ([@LionelPaulus](http://github.com/LionelPaulus))
- Gorbasch ([@mbegerau](http://github.com/mbegerau))
- Harlan Wilton ([@harlan-zw](http://github.com/harlan-zw))
- Tobias Diez <code@tobiasdiez.com>
- Tim Blommestijn ([@TMBL-DEV](http://github.com/TMBL-DEV))
- Daniel Roe ([@danielroe](http://github.com/danielroe))
- Luke Nelson <luke@nelson.zone>
- Nermal ([@nermalcat69](http://github.com/nermalcat69))
- Tudor Pipernea ([@tudorpip](http://github.com/tudorpip))
- Adam DeHaven ([@adamdehaven](http://github.com/adamdehaven))
- Gerome Grignon ([@geromegrignon](http://github.com/geromegrignon))
- Anbraten ([@anbraten](http://github.com/anbraten))
- Chris Saganic ([@Saganic](http://github.com/Saganic))
- Juho Rutila ([@nice-game-hints](http://github.com/nice-game-hints))
- JinU Choi ([@dalbodeule](http://github.com/dalbodeule))
- Estéban ([@Barbapapazes](http://github.com/Barbapapazes))
- Maik Kowol ([@94726](http://github.com/94726))
- VisuSubbaiyan <visu.subbaiyan@gmail.com>
- Ashcolor ([@ashcolor](http://github.com/ashcolor))
- Guten <ywzhaifei@gmail.com>
- Matteo Rigoni ([@Rigo-m](http://github.com/Rigo-m))
- Brandon Roberts ([@brandonroberts](http://github.com/brandonroberts))
- Ariesly <Ariesly.Mao@hotmail.com>
- Star Knight ([@starknt](http://github.com/starknt))
- Jonas Thelemann <e-mail@jonas-thelemann.de>
- Dominik Rajkowski ([@dominiq007](http://github.com/dominiq007))
- Julien Blatecky ([@julien1619](http://github.com/julien1619))
- Ígor Jacaúna ([@igorjacauna](http://github.com/igorjacauna))
- Leex <jsonleex@163.com>
- Martins Zeltins
- Markthree ([@markthree](http://github.com/markthree))
- Matej Černý ([@CernyMatej](http://github.com/CernyMatej))
- Julien Huang <julien.huang@outlook.fr>
- Viktor Szépe ([@szepeviktor](http://github.com/szepeviktor))
- Nicolas Payot ([@nicolaspayot](http://github.com/nicolaspayot))
- BaboonKing <changfan.xu.up@qq.com>
- Ēriks Lapiņš ([@eriksLapins](http://github.com/eriksLapins))
- Yuurin ([@byyuurin](http://github.com/byyuurin))
- Hans Pagel
- Sby1ce ([@sby1ce](http://github.com/sby1ce))
- Rahul Mishra <blankparticle@gmail.com>

## v2.9.6

[compare changes](https://github.com/nitrojs/nitro/compare/v2.9.5...v2.9.6)

### 🩹 Fixes

- Generate root/src directory aliases ([#2318](https://github.com/nitrojs/nitro/pull/2318))
- **externals:** Skip resolving virtual ids start with `\0` ([#2321](https://github.com/nitrojs/nitro/pull/2321))
- **types:** Account for `undefined` value for `$fetch` return type ([#2327](https://github.com/nitrojs/nitro/pull/2327))
- **cloudflare-pages:** Use predefined wildcards in `routes.exclude` ([#2319](https://github.com/nitrojs/nitro/pull/2319))

### 📖 Documentation

- Remove outdated nightly warning ([#2317](https://github.com/nitrojs/nitro/pull/2317))

### 🏡 Chore

- Update docs lockfile ([825d94fa](https://github.com/nitrojs/nitro/commit/825d94fa))
- **docs:** Update lock ([c343a2d0](https://github.com/nitrojs/nitro/commit/c343a2d0))
- Update lockfile ([fcc0f9a3](https://github.com/nitrojs/nitro/commit/fcc0f9a3))

### ❤️ Contributors

- Peter Graugaard <git@graugaard.me>
- Damian Głowala ([@DamianGlowala](http://github.com/DamianGlowala))
- Pooya Parsa ([@pi0](http://github.com/pi0))
- Daniel Roe ([@danielroe](http://github.com/danielroe))
- Stefan

## v2.9.5

[compare changes](https://github.com/nitrojs/nitro/compare/v2.9.4...v2.9.5)

### 🚀 Enhancements

- **openapi:** Add experimental `/_nitro/scalar` endpoint ([#2252](https://github.com/nitrojs/nitro/pull/2252))

### 🩹 Fixes

- **openapi:** Use dynamic host + port ([#2216](https://github.com/nitrojs/nitro/pull/2216))
- **openapi:** Add `schema` to generated parameters ([#2235](https://github.com/nitrojs/nitro/pull/2235))
- **openapi:** Avoid double slash for base ([fdf7e70a](https://github.com/nitrojs/nitro/commit/fdf7e70a))
- **options:** Set `scheduledTasks` to an empty object by default ([#2285](https://github.com/nitrojs/nitro/pull/2285))
- **prerender:** Call `nitroApp` close hook when done prerendering ([#2287](https://github.com/nitrojs/nitro/pull/2287))
- **types:** Return `T` from `Serialize` when it extends `undefined` ([#2286](https://github.com/nitrojs/nitro/pull/2286))
- **raw:** Exclude yaml from raw plugin ([#2275](https://github.com/nitrojs/nitro/pull/2275))
- **externals:** Check explicit inline rules on resolved id ([#2288](https://github.com/nitrojs/nitro/pull/2288))
- **raw:** Allow importing relative paths ([#2289](https://github.com/nitrojs/nitro/pull/2289))
- **types:** Make c12 env types available for `NitroConfig` ([#2292](https://github.com/nitrojs/nitro/pull/2292))
- **netlify-edge:** Write `_headers` and `_redirects` ([#2291](https://github.com/nitrojs/nitro/pull/2291))
- **cloudflare-pages:** Write `_headers` and `_redirects` for non static builds ([#2290](https://github.com/nitrojs/nitro/pull/2290))
- **netlify:** Allow writing `config.json` ([#2264](https://github.com/nitrojs/nitro/pull/2264))
- Allow importing utils from `nitropack/runtime` ([#2314](https://github.com/nitrojs/nitro/pull/2314))

### 💅 Refactors

- **openapi:** Upgrade to openapi 3.1 ([#2297](https://github.com/nitrojs/nitro/pull/2297))

### 📖 Documentation

- **routing:** Add note about middleware execution order ([#2282](https://github.com/nitrojs/nitro/pull/2282))
- **routing:** Fx link to h3 object syntax handler ([#2281](https://github.com/nitrojs/nitro/pull/2281))
- Update tasks return value ([8a62e7db](https://github.com/nitrojs/nitro/commit/8a62e7db))
- **cache:** Add a note for serverless environment ([dc83a2e2](https://github.com/nitrojs/nitro/commit/dc83a2e2))
- Fix typo ([#2298](https://github.com/nitrojs/nitro/pull/2298))

### 📦 Build

- Use `.d.ts` for runtime generated types ([#2313](https://github.com/nitrojs/nitro/pull/2313))

### 🏡 Chore

- Lint ([f7330329](https://github.com/nitrojs/nitro/commit/f7330329))
- Update docs ([00c308c1](https://github.com/nitrojs/nitro/commit/00c308c1))
- Update deps and lockfile ([55fd222b](https://github.com/nitrojs/nitro/commit/55fd222b))
- Remove unused imports ([#2293](https://github.com/nitrojs/nitro/pull/2293))
- Update deps and lockfile ([40883766](https://github.com/nitrojs/nitro/commit/40883766))
- Update radix3 and lockfile ([7429465f](https://github.com/nitrojs/nitro/commit/7429465f))

### ❤️ Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))
- Matt Kane <matt.kane@netlify.com>
- Hans Pagel
- Jamaluddin Rumi <16121031@student.mercubuana-yogya.ac.id>
- Julien Huang <julien.huang@outlook.fr>
- Bobbie Goede <bobbiegoede@gmail.com>
- Damian Głowala ([@DamianGlowala](http://github.com/DamianGlowala))
- Daniel Roe ([@danielroe](http://github.com/danielroe))
- Sébastien Chopin ([@Atinux](http://github.com/Atinux))
- Neil Richter ([@noook](http://github.com/noook))
- Samuel Burkhard <sxburk@gmail.com>
- Shoshana Connack ([@moshetanzer](http://github.com/moshetanzer))
- Yuurin ([@byyuurin](http://github.com/byyuurin))
- Markthree ([@markthree](http://github.com/markthree))

## v2.9.4

[compare changes](https://github.com/nitrojs/nitro/compare/v2.9.3...v2.9.4)

### 🩹 Fixes

- Handle path negations when scanning public assets ([#2250](https://github.com/nitrojs/nitro/pull/2250))
- **pkg:** Add `ioredis` as unstorage peer dependency ([#2266](https://github.com/nitrojs/nitro/pull/2266))

### 📖 Documentation

- Fix server assets example path ([#2248](https://github.com/nitrojs/nitro/pull/2248))
- Remove duplicate `integrity` key ([#2246](https://github.com/nitrojs/nitro/pull/2246))
- Fix wording ([#2261](https://github.com/nitrojs/nitro/pull/2261))
- Remove nightly notice ([39bc3f2e](https://github.com/nitrojs/nitro/commit/39bc3f2e))
- **tasks:** Update dev server usage ([#2240](https://github.com/nitrojs/nitro/pull/2240))
- **cache:** Add example usage for `cache.varies` ([#2241](https://github.com/nitrojs/nitro/pull/2241))

### 🏡 Chore

- Fix typo ([#2260](https://github.com/nitrojs/nitro/pull/2260))
- Update lockfile ([d8fafe4d](https://github.com/nitrojs/nitro/commit/d8fafe4d))
- Update ufo ([b6cc11c7](https://github.com/nitrojs/nitro/commit/b6cc11c7))

### ✅ Tests

- Increase timeout ([0f089d3e](https://github.com/nitrojs/nitro/commit/0f089d3e))

### ❤️ Contributors

- Adam DeHaven ([@adamdehaven](http://github.com/adamdehaven))
- Neil Richter ([@noook](http://github.com/noook))
- Pooya Parsa ([@pi0](http://github.com/pi0))
- Alexander Lichter ([@manniL](http://github.com/manniL))
- KobZ ([@devseckobz](http://github.com/devseckobz))
- Klein Petr <petr@kleinpetr.com>
- Daniel Roe ([@danielroe](http://github.com/danielroe))

## v2.9.3

[compare changes](https://github.com/nitrojs/nitro/compare/v2.9.2...v2.9.3)

### 🩹 Fixes

- **raw:** Use mime to check binary types and exclude `.json` ([#2239](https://github.com/nitrojs/nitro/pull/2239))

### 📖 Documentation

- Fix typo ([a445fae6](https://github.com/nitrojs/nitro/commit/a445fae6))

### ❤️ Contributors

- Pooya Parsa <pyapar@gmail.com>
- Keigo Nakao ([@kspace-trk](http://github.com/kspace-trk))

## v2.9.2

[compare changes](https://github.com/nitrojs/nitro/compare/v2.9.1...v2.9.2)

### 🩹 Fixes

- **database:** CamelCase the connector name ([#2228](https://github.com/nitrojs/nitro/pull/2228))
- Respect `imports.autoImport: false` ([#2226](https://github.com/nitrojs/nitro/pull/2226))
- **server-assets:** Mark `yaml`, `json`, `json5` and `csv` as text ([#2229](https://github.com/nitrojs/nitro/pull/2229))
- **import-meta:** Import `process` from `node:process` for node compatible builds (deno) ([#2225](https://github.com/nitrojs/nitro/pull/2225))

### 📖 Documentation

- **deploy:** Add link to zero config providers ([#2206](https://github.com/nitrojs/nitro/pull/2206))
- **fetch:** Fix typo ([#2209](https://github.com/nitrojs/nitro/pull/2209))
- Fix typo ([#2211](https://github.com/nitrojs/nitro/pull/2211))
- Fix typo ([#2205](https://github.com/nitrojs/nitro/pull/2205))
- Remove lagon ([#2204](https://github.com/nitrojs/nitro/pull/2204))
- Update url for experimental database feature ([#2210](https://github.com/nitrojs/nitro/pull/2210))
- **providers:** Improve formatting & use new `undocs` components ([#2202](https://github.com/nitrojs/nitro/pull/2202))
- Improve cache page ([674089b3](https://github.com/nitrojs/nitro/commit/674089b3))

### 🏡 Chore

- **release:** V2.9.1 ([d8491cdc](https://github.com/nitrojs/nitro/commit/d8491cdc))
- **examples:** Update hello-world ([169ec572](https://github.com/nitrojs/nitro/commit/169ec572))
- Update deps and lockfile ([3875e50d](https://github.com/nitrojs/nitro/commit/3875e50d))
- Update lockfile ([e3f555ac](https://github.com/nitrojs/nitro/commit/e3f555ac))
- Remove lagon ([#2203](https://github.com/nitrojs/nitro/pull/2203))
- Update `hello-world` example ([920b399e](https://github.com/nitrojs/nitro/commit/920b399e))
- Update lockfile ([08da539f](https://github.com/nitrojs/nitro/commit/08da539f))
- Improve notes in pr template ([#2212](https://github.com/nitrojs/nitro/pull/2212))
- Update dependencies ([be2c70be](https://github.com/nitrojs/nitro/commit/be2c70be))
- Use type import in tests ([1cb410db](https://github.com/nitrojs/nitro/commit/1cb410db))
- Increase test timeout ([7a65d1ef](https://github.com/nitrojs/nitro/commit/7a65d1ef))

### ❤️ Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))
- Divy Srivastava ([@littledivy](http://github.com/littledivy))
- Alexander Lichter <github@lichter.io>
- Daniel Roe ([@danielroe](http://github.com/danielroe))
- Sébastien Chopin ([@Atinux](http://github.com/Atinux))
- Christian Preston ([@cpreston321](http://github.com/cpreston321))
- Phan Khắc Đạo <daopk.dev@gmail.com>
- Maxime Pauvert ([@maximepvrt](http://github.com/maximepvrt))
- Jeff Galbraith ([@hawkeye64](http://github.com/hawkeye64))
- Rajeev R Sharma <i.rarsh@gmail.com>
- Julien Vanelian ([@JulienVanelian](http://github.com/JulienVanelian))
- Gangan ([@shinGangan](http://github.com/shinGangan))

## v2.9.1

[compare changes](https://github.com/nitrojs/nitro/compare/v2.9.0...v2.9.1)

### 🩹 Fixes

- Disable scheduled tasks in testing environment ([#2200](https://github.com/nitrojs/nitro/pull/2200))

### 📖 Documentation

- Add websocket chat demo to websocket api page ([#2189](https://github.com/nitrojs/nitro/pull/2189))
- Fix typo ([#2190](https://github.com/nitrojs/nitro/pull/2190))
- Fix typo ([#2194](https://github.com/nitrojs/nitro/pull/2194))

### 🤖 CI

- Skip `cloudflare-pages` test for windows ([#2199](https://github.com/nitrojs/nitro/pull/2199))

### ❤️ Contributors

- Pooya Parsa <pyapar@gmail.com>
- Roman Nuritdinov ([@Ky6uk](http://github.com/Ky6uk))
- Stefan <stefan.heim@hotmail.com>
- Shoshana Connack

## v2.9.0

[compare changes](https://github.com/nitrojs/nitro/compare/v2.8.1...v2.9.0)

### 🚀 Enhancements

- Support function/RegExp for `prerender.ignore` ([#1966](https://github.com/nitrojs/nitro/pull/1966))
- Show meta framework name on server build success ([#1955](https://github.com/nitrojs/nitro/pull/1955))
- Add zeabur preset ([#1942](https://github.com/nitrojs/nitro/pull/1942))
- Experimental nitro tasks ([#1929](https://github.com/nitrojs/nitro/pull/1929))
- Add `types:extend` hook ([#1715](https://github.com/nitrojs/nitro/pull/1715))
- Allow oveeridng nested runtime config with env ([#1831](https://github.com/nitrojs/nitro/pull/1831))
- **wasm:** Universal support with esm import syntax ([#2017](https://github.com/nitrojs/nitro/pull/2017))
- **wasm:** Migrate to unjs/unwasm ([#2037](https://github.com/nitrojs/nitro/pull/2037))
- **zeabur:** Support `zeaburStatic` and auto detect preset ([#2014](https://github.com/nitrojs/nitro/pull/2014))
- **runtime-config:** Experimental env expansion support ([#2043](https://github.com/nitrojs/nitro/pull/2043))
- Support binary server assets ([#2107](https://github.com/nitrojs/nitro/pull/2107))
- Experimental websocket support ([#2170](https://github.com/nitrojs/nitro/pull/2170))
- **dev:** Expose upgrade handler ([5374429f](https://github.com/nitrojs/nitro/commit/5374429f))
- Experimental database layer ([#1351](https://github.com/nitrojs/nitro/pull/1351))
- Experimental scheduled tasks ([#2179](https://github.com/nitrojs/nitro/pull/2179))
- **cache:** Support async `shouldBypassCache` and `shouldInvalidateCache` ([#2181](https://github.com/nitrojs/nitro/pull/2181))
- **prerender:** Add total prerender time ([#2130](https://github.com/nitrojs/nitro/pull/2130))
- Add koyeb preset ([#1248](https://github.com/nitrojs/nitro/pull/1248))
- **providers:** Support alwaysdata hosting provider ([#1790](https://github.com/nitrojs/nitro/pull/1790))
- **routeRules:** Allow wildcard redirects ([#1976](https://github.com/nitrojs/nitro/pull/1976))

### 🩹 Fixes

- **rollup:** Avoid preserving relative externals ([#1972](https://github.com/nitrojs/nitro/pull/1972))
- **wasm:** Directly generate chunk exports ([#2003](https://github.com/nitrojs/nitro/pull/2003))
- **iis-node:** Correctly escape backslashes for port fix ([#2020](https://github.com/nitrojs/nitro/pull/2020))
- **deno-deploy:** Shim `x-forwarded-for` and `x-forwarded-proto` headers ([#2026](https://github.com/nitrojs/nitro/pull/2026))
- Add `baseURL` to openapi generated url ([#2049](https://github.com/nitrojs/nitro/pull/2049))
- **dev:** Correctly set `x-forwarded-*` headers ([29ddd948](https://github.com/nitrojs/nitro/commit/29ddd948))
- **azure:** Add `18` and `20` to supported node versions ([#2077](https://github.com/nitrojs/nitro/pull/2077))
- **azure:** Pass body to the context as-is ([#2079](https://github.com/nitrojs/nitro/pull/2079))
- Only mock consola in production ([#2110](https://github.com/nitrojs/nitro/pull/2110))
- Default to `bundler` module resolution ([#2120](https://github.com/nitrojs/nitro/pull/2120))
- Handle optional `routeHandler.route` in rollup chunk ([#2152](https://github.com/nitrojs/nitro/pull/2152))
- File extension stripping in `writeTypes` function ([#2139](https://github.com/nitrojs/nitro/pull/2139))
- **cache:** Detect malformed data read from storage ([#2161](https://github.com/nitrojs/nitro/pull/2161))
- **cacheEventHandler:** Provide `event.fetch` and `event.$fetch` ([#2066](https://github.com/nitrojs/nitro/pull/2066))
- Resolve modules with jiti directly ([#2030](https://github.com/nitrojs/nitro/pull/2030))
- **options:** Add `unwasm` condition when `experimental.wasm` is enabled ([376658ce](https://github.com/nitrojs/nitro/commit/376658ce))

### 💅 Refactors

- Include framework name in more build packages ([#1973](https://github.com/nitrojs/nitro/pull/1973))
- **cloudflare:** Remove `--local` from preview commands ([#1979](https://github.com/nitrojs/nitro/pull/1979))
- **cloudflare:** Remove unused import ([#1980](https://github.com/nitrojs/nitro/pull/1980))
- **rollup:** Improve generated chunk names ([#2004](https://github.com/nitrojs/nitro/pull/2004))
- Use name exports in presets entry ([1abfc3e5](https://github.com/nitrojs/nitro/commit/1abfc3e5))
- Reimplement wasm plugin ([#2031](https://github.com/nitrojs/nitro/pull/2031))
- Various improvements around tasks api ([#2175](https://github.com/nitrojs/nitro/pull/2175))
- **tasks:** Stabilize api ([#2178](https://github.com/nitrojs/nitro/pull/2178))
- **github-pages:** Add `--dotfiles` to deploy command hint ([#2158](https://github.com/nitrojs/nitro/pull/2158))

### 📖 Documentation

- **routing:** Update request filtering to match the type of `getRequestURL` ([#1977](https://github.com/nitrojs/nitro/pull/1977))
- **config:** Fix `setResponseHeader` example params ([#2027](https://github.com/nitrojs/nitro/pull/2027))
- **netlify:** Add note to make sure publish dist is set to `dist` ([#2035](https://github.com/nitrojs/nitro/pull/2035))
- **cloudflare:** Various updates, cleanups and fixes ([#1981](https://github.com/nitrojs/nitro/pull/1981))
- Deprecate lagon ([17f922aa](https://github.com/nitrojs/nitro/commit/17f922aa))
- Update the routing page ([#2085](https://github.com/nitrojs/nitro/pull/2085))
- Update the cache page ([#2087](https://github.com/nitrojs/nitro/pull/2087))
- Close code-group in cache section ([#2093](https://github.com/nitrojs/nitro/pull/2093))
- **routing:** Escape filename paths and prepend routes folder ([#2097](https://github.com/nitrojs/nitro/pull/2097))
- **storage:** Fix unstorage links ([#2101](https://github.com/nitrojs/nitro/pull/2101))
- **routing:** Fix typo for `getRouterParam` ([#2098](https://github.com/nitrojs/nitro/pull/2098))
- Update the storage page ([#2086](https://github.com/nitrojs/nitro/pull/2086))
- Add object syntax for event handler ([#2091](https://github.com/nitrojs/nitro/pull/2091))
- Update the configuration page ([#2083](https://github.com/nitrojs/nitro/pull/2083))
- Update the assets page ([#2088](https://github.com/nitrojs/nitro/pull/2088))
- Create a page on built-in fetch ([#2089](https://github.com/nitrojs/nitro/pull/2089))
- Add warning about azure functions stability ([#2092](https://github.com/nitrojs/nitro/pull/2092))
- **cloudflare:** Update deployment guide ([#2074](https://github.com/nitrojs/nitro/pull/2074))
- Fix icon of fetch page ([#2115](https://github.com/nitrojs/nitro/pull/2115))
- Update getting started page ([#2082](https://github.com/nitrojs/nitro/pull/2082))
- Fix links to /guide/auto-imports ([#2131](https://github.com/nitrojs/nitro/pull/2131))
- Fix typo in defineCachedFunction example ([#2133](https://github.com/nitrojs/nitro/pull/2133))
- Clarify difference between dir and baseURL ([#2144](https://github.com/nitrojs/nitro/pull/2144))
- Migrate to undocs ([#2163](https://github.com/nitrojs/nitro/pull/2163))
- **index:** Fix utils link ([#2172](https://github.com/nitrojs/nitro/pull/2172))
- **websocket:** Fix typo ([#2173](https://github.com/nitrojs/nitro/pull/2173))
- Fix typo ([3017e6e2](https://github.com/nitrojs/nitro/commit/3017e6e2))
- **vercel:** Add monorepo info ([#2183](https://github.com/nitrojs/nitro/pull/2183))
- Fix typo ([#2182](https://github.com/nitrojs/nitro/pull/2182))
- **cloudflare:** Add local bindings usage ([#2135](https://github.com/nitrojs/nitro/pull/2135))
- Fix link to h3 utils ([#2184](https://github.com/nitrojs/nitro/pull/2184))
- **deploy:** Add `platform.sh` ([#1630](https://github.com/nitrojs/nitro/pull/1630))
- Fix db config ([#2188](https://github.com/nitrojs/nitro/pull/2188))

### 📦 Build

- Better dist chunk names ([#2005](https://github.com/nitrojs/nitro/pull/2005))

### 🏡 Chore

- **release:** V2.8.1 ([48c79556](https://github.com/nitrojs/nitro/commit/48c79556))
- Add missing `cloudflarePagesStatic` ([5ead36f7](https://github.com/nitrojs/nitro/commit/5ead36f7))
- Update lockfile ([884a1e24](https://github.com/nitrojs/nitro/commit/884a1e24))
- Update dev dependencies ([76776513](https://github.com/nitrojs/nitro/commit/76776513))
- Downgrade `@azure/functions` back to v3 ([0a765f2d](https://github.com/nitrojs/nitro/commit/0a765f2d))
- Downgrade undici until upgrading miniflare ([0b2e3b8e](https://github.com/nitrojs/nitro/commit/0b2e3b8e))
- **docs:** Update lockfile ([0c216cf3](https://github.com/nitrojs/nitro/commit/0c216cf3))
- Update lockfile ([444c9f22](https://github.com/nitrojs/nitro/commit/444c9f22))
- Update type test ([50cd9173](https://github.com/nitrojs/nitro/commit/50cd9173))
- Update type test to pass linter ([cbcafa14](https://github.com/nitrojs/nitro/commit/cbcafa14))
- Update undocs ([e2fa76b0](https://github.com/nitrojs/nitro/commit/e2fa76b0))
- Remove extra `.npmrc` ([55a22b9f](https://github.com/nitrojs/nitro/commit/55a22b9f))
- Update readme ([d840eb9a](https://github.com/nitrojs/nitro/commit/d840eb9a))
- Update dependencies ([#2169](https://github.com/nitrojs/nitro/pull/2169))
- Update docs ([5b0e150e](https://github.com/nitrojs/nitro/commit/5b0e150e))

### ✅ Tests

- **cloudflare:** Migrate to miniflare v3 ([#2018](https://github.com/nitrojs/nitro/pull/2018))
- Enable azure tests behind a flag ([#2076](https://github.com/nitrojs/nitro/pull/2076))
- Enable binary response test for all presets ([#2078](https://github.com/nitrojs/nitro/pull/2078))
- Avoid prerendering `icon.png` ([cb220f7e](https://github.com/nitrojs/nitro/commit/cb220f7e))

### 🤖 CI

- Fix nightly release job condition ([#1975](https://github.com/nitrojs/nitro/pull/1975))

### ❤️ Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))
- Cas Du Plessis <go4cas@gmail.com>
- Julien Huang <julien.huang@outlook.fr>
- Jasper Zonneveld
- M4dz ([@m4dz](http://github.com/m4dz))
- Dominik Opyd <dominik.opyd@gmail.com>
- Justin Ellingwood <justin.ellingwood@gmail.com>
- Connor Pearson <cjp822@gmail.com>
- Alexander Lichter ([@manniL](http://github.com/manniL))
- David De Sloovere
- Dario Piotrowicz <dario@cloudflare.com>
- Balázs Németh
- Mehmet <hi@productdevbook.com>
- Markthree ([@markthree](http://github.com/markthree))
- Arkadiusz Sygulski <aareksio@gmail.com>
- Jamaluddin Rumi <jamal.rumi@icloud.com>
- McPizza <gh@l1.io>
- Shoshana Connack
- Anthony Fu <anthonyfu117@hotmail.com>
- Jackson Tenclay
- Rihan ([@RihanArfan](http://github.com/RihanArfan))
- Remonke
- Daniel Roe ([@danielroe](http://github.com/danielroe))
- Estéban ([@Barbapapazes](http://github.com/Barbapapazes))
- Gerard Wilkinson <gerard.wilkinson@me.com>
- Tobias Lebeitsuk
- Alexander ([@cany748](http://github.com/cany748))
- Kasper Kronborg <kasper@kronborg.info>
- Gustavo Alfredo Marín Sáez <aterbonus@gmail.com>
- Alexandr
- Yuanlin Lin <im.yuanlinlin@gmail.com>
- Mcremer-able <marc.cremer@able-group.de>
- Jasonleong <jasonliangbiz@gmail.com>
- METO ([@metowolf](http://github.com/metowolf))
- Michael Brevard <yonshi29@gmail.com>
- Bobbie Goede <bobbiegoede@gmail.com>
- Becem ([@becem-gharbi](http://github.com/becem-gharbi))
- Mukund Shah
- Ayo Ayco ([@ayoayco](http://github.com/ayoayco))

## v2.8.1

[compare changes](https://github.com/nitrojs/nitro/compare/v2.8.0...v2.8.1)

### 🩹 Fixes

- **dev:** Conditionally access worker address for build info ([#1947](https://github.com/nitrojs/nitro/pull/1947))
- Force use wasm import strategy for windows ([e73b849f](https://github.com/nitrojs/nitro/commit/e73b849f))
- **netlify-lambda:** Handle base64 encoded body ([#1940](https://github.com/nitrojs/nitro/pull/1940))
- **cloudflare:** Wasm support with dynamic chunks ([#1957](https://github.com/nitrojs/nitro/pull/1957))
- **prerenderer:** Write responses with json signature to original path ([#1963](https://github.com/nitrojs/nitro/pull/1963))

### 📖 Documentation

- **cache:** Make default value `swr: true` more clear ([#1949](https://github.com/nitrojs/nitro/pull/1949))

### 🏡 Chore

- Update lockfile ([716edd52](https://github.com/nitrojs/nitro/commit/716edd52))
- **docs:** Update lockfile ([b4386f8c](https://github.com/nitrojs/nitro/commit/b4386f8c))

### ✅ Tests

- Add tests for wasm ([#1951](https://github.com/nitrojs/nitro/pull/1951))
- **cloudflare-pages:** Remover overlapping include rules ([789a13d3](https://github.com/nitrojs/nitro/commit/789a13d3))

### ❤️ Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))
- Becem <becem.gharbi@live.com>
- Mick Lawitzke ([@MickL](http://github.com/MickL))

## v2.8.0

[compare changes](https://github.com/nitrojs/nitro/compare/v2.7.1...v2.8.0)

### 🚀 Enhancements

- Support modules to extend nitro builder ([#1789](https://github.com/nitrojs/nitro/pull/1789))
- Support `inline` mode for `serveStatic` ([#1864](https://github.com/nitrojs/nitro/pull/1864))
- Add experimental `winterjs` preset ([#1863](https://github.com/nitrojs/nitro/pull/1863))
- Allow setting preset using `SERVER_PRESET` environment variable ([#1870](https://github.com/nitrojs/nitro/pull/1870))
- **cloudflare-pages, cloudflare-module:** Enable code splitting by default ([#1905](https://github.com/nitrojs/nitro/pull/1905))
- Support `framework` config ([#1843](https://github.com/nitrojs/nitro/pull/1843))
- Add aws amplify hosting preset ([#1912](https://github.com/nitrojs/nitro/pull/1912))
- Upgrade to rollup v4 ([#1927](https://github.com/nitrojs/nitro/pull/1927))
- Improve `nitro.json` build info ([#1930](https://github.com/nitrojs/nitro/pull/1930))
- **aws-amplify:** Support static builds ([#1933](https://github.com/nitrojs/nitro/pull/1933))
- Add `defineNitroErrorHandler` type helper ([#1923](https://github.com/nitrojs/nitro/pull/1923))

### 🩹 Fixes

- **cloudflare-pages:** Filter out overlapping public assets dirs ([#1859](https://github.com/nitrojs/nitro/pull/1859))
- **winterjs:** 0.1.7 compatibility ([#1876](https://github.com/nitrojs/nitro/pull/1876))
- **scanner:** Allow having http method as part of the route name ([#1895](https://github.com/nitrojs/nitro/pull/1895))
- Generate route types with resolve path and stripped extension ([#1897](https://github.com/nitrojs/nitro/pull/1897))
- Scan dirs for unimport on initialization ([#1908](https://github.com/nitrojs/nitro/pull/1908))
- **aws-amplify:** Register and auto detect ([0f38eb6f](https://github.com/nitrojs/nitro/commit/0f38eb6f))
- **prerender:** Decode generated routes ([#1914](https://github.com/nitrojs/nitro/pull/1914))
- Disabled public asset handler name is `null` ([b7a6a1a6](https://github.com/nitrojs/nitro/commit/b7a6a1a6))
- **prerender:** Decode uris in headers ([#1932](https://github.com/nitrojs/nitro/pull/1932))
- **error:** Respect `accept: text/html` request header ([#1921](https://github.com/nitrojs/nitro/pull/1921))
- **prerender:** Filter encoded links starting with `#` ([#1936](https://github.com/nitrojs/nitro/pull/1936))

### 💅 Refactors

- **deno-deploy:** Use `Deno.serve` ([#1879](https://github.com/nitrojs/nitro/pull/1879))
- Split preset types ([#1910](https://github.com/nitrojs/nitro/pull/1910))

### 📖 Documentation

- **deploy:** Split runtimes from providers ([#1865](https://github.com/nitrojs/nitro/pull/1865))
- **routing:** Add note about middleware returns ([#1884](https://github.com/nitrojs/nitro/pull/1884))
- Update edge links to nightly ([#1902](https://github.com/nitrojs/nitro/pull/1902))
- **deploy:** Add deno to runtime list ([#1899](https://github.com/nitrojs/nitro/pull/1899))
- **cloudflare:** Updatge wrangler link ([#1913](https://github.com/nitrojs/nitro/pull/1913))
- **aws-amplify:** Add custom `amplify.yml` ([f412af16](https://github.com/nitrojs/nitro/commit/f412af16))
- **amplify:** Remove cache from config ([7bbb723e](https://github.com/nitrojs/nitro/commit/7bbb723e))
- Hide winterjs due to unstability ([048c8ff0](https://github.com/nitrojs/nitro/commit/048c8ff0))
- **aws-amplify:** Update regions ([#1931](https://github.com/nitrojs/nitro/pull/1931))
- **aws-amplify:** Add step to enable SSR logging and remove experimental ([#1934](https://github.com/nitrojs/nitro/pull/1934))
- **aws-amplify:** Remove workaround banner ([#1935](https://github.com/nitrojs/nitro/pull/1935))

### 🌊 Types

- Export `SerializeTuple` and `SerializeObject` ([#1907](https://github.com/nitrojs/nitro/pull/1907))

### 🏡 Chore

- **release:** V2.7.1 ([2d803a3c](https://github.com/nitrojs/nitro/commit/2d803a3c))
- Add jsdoc for `cache.maxAge` ([#1878](https://github.com/nitrojs/nitro/pull/1878))
- Update lockfile ([dbff232e](https://github.com/nitrojs/nitro/commit/dbff232e))
- **docs:** Update dependencies ([28867009](https://github.com/nitrojs/nitro/commit/28867009))
- **docs:** Fix prerender issues ([d2a7d84d](https://github.com/nitrojs/nitro/commit/d2a7d84d))
- Update unstorage ([110bc4a3](https://github.com/nitrojs/nitro/commit/110bc4a3))
- Update unstorage ([441db6ca](https://github.com/nitrojs/nitro/commit/441db6ca))
- Fix typos in aws amplify ([963716dd](https://github.com/nitrojs/nitro/commit/963716dd))
- Update lockfile ([926bcef4](https://github.com/nitrojs/nitro/commit/926bcef4))

### ✅ Tests

- Hide winterjs due to unstability ([1b50a9a1](https://github.com/nitrojs/nitro/commit/1b50a9a1))

### 🤖 CI

- Disable codecov and codeql ([fd4671ce](https://github.com/nitrojs/nitro/commit/fd4671ce))

### ❤️ Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))
- Siegerts <stephen.siegert@gmail.com>
- Passionate-bram
- Daniel Roe <daniel@roe.dev>
- Neil Richter ([@noook](http://github.com/noook))
- Xin Du (Clark) <clark.duxin@gmail.com>
- Anthony Fu <anthonyfu117@hotmail.com>
- Dario Piotrowicz ([@dario-piotrowicz](http://github.com/dario-piotrowicz))
- Kalwabed Rizki
- Thunfisch987
- Oof2win2 <honza.koco44@gmail.com>
- Markthree ([@markthree](http://github.com/markthree))
- Estéban ([@Barbapapazes](http://github.com/Barbapapazes))

## v2.7.1

[compare changes](https://github.com/nitrojs/nitro/compare/v2.7.0...v2.7.1)

### 🩹 Fixes

- Recursively simplify returned objects ([#1847](https://github.com/nitrojs/nitro/pull/1847))
- **cache:** Fix `etag` and `last-modified` values ([#1855](https://github.com/nitrojs/nitro/pull/1855))
- **cache:** Invalidate wrongly cached  handler entities ([#1857](https://github.com/nitrojs/nitro/pull/1857))

### 🏡 Chore

- Update dependencies ([7a6c61db](https://github.com/nitrojs/nitro/commit/7a6c61db))
- Update lockfile ([9b5ed9a1](https://github.com/nitrojs/nitro/commit/9b5ed9a1))
- Update lockfile ([b0ec181d](https://github.com/nitrojs/nitro/commit/b0ec181d))

### ❤️ Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))
- Daniel Roe <daniel@roe.dev>

## v2.7.0

[compare changes](https://github.com/nitrojs/nitro/compare/v2.6.3...v2.7.0)

### 🚀 Enhancements

- **vercel:** Support `bypassToken` for on-demand static reganaration ([#1723](https://github.com/nitrojs/nitro/pull/1723))
- **prerender:** Support `retry` and `retryDelay` ([#1534](https://github.com/nitrojs/nitro/pull/1534))
- Allow disabling compressed size calculation ([#1756](https://github.com/nitrojs/nitro/pull/1756))

### 🔥 Performance

- Use native fetch for `node >= 18` to reduce `%40` of bundle size ([#1724](https://github.com/nitrojs/nitro/pull/1724))

### 🩹 Fixes

- Sort dependencies in `.output/package.json` ([#1708](https://github.com/nitrojs/nitro/pull/1708))
- Add `application/javascript` mime type in lambda utils ([#1737](https://github.com/nitrojs/nitro/pull/1737))
- **renderer:** Allow all h3 handled body types ([#1755](https://github.com/nitrojs/nitro/pull/1755))
- **dev:** Safe error message override ([#1712](https://github.com/nitrojs/nitro/pull/1712))
- **azure:** Fix cookie format normalization ([#1753](https://github.com/nitrojs/nitro/pull/1753))
- Exclude undefined from hook types ([#1769](https://github.com/nitrojs/nitro/pull/1769))
- **iis-node:** Pass `PORT` as `NITRO_UNIX_SOCKET` ([#1783](https://github.com/nitrojs/nitro/pull/1783))
- **aws-lambda:** Handle `event.isBase64Encoded` ([#1779](https://github.com/nitrojs/nitro/pull/1779))
- **cache:** Allow overriding integrity ([#1791](https://github.com/nitrojs/nitro/pull/1791))
- **cache:** Write swr and update errors to console ([#1794](https://github.com/nitrojs/nitro/pull/1794))
- **cache:** Only return validated stale value ([#1795](https://github.com/nitrojs/nitro/pull/1795))
- **cache:** Only invalidate if `validate` returns `false` ([#1796](https://github.com/nitrojs/nitro/pull/1796))
- Watch plugins directory ([#1800](https://github.com/nitrojs/nitro/pull/1800))
- **cache:** Allow setting multiple `set-cookie` headers (bad practice) ([#1838](https://github.com/nitrojs/nitro/pull/1838))
- **prerender:** Decode html entities in rendered links ([#1824](https://github.com/nitrojs/nitro/pull/1824))
- **storage:** Validate and skip invalid mounts ([#1805](https://github.com/nitrojs/nitro/pull/1805))
- **cache:** Validate `entry.value` to have value for cached handlers ([84559382](https://github.com/nitrojs/nitro/commit/84559382))
- **cache:** Fix event handler integrity hash generation ([#1820](https://github.com/nitrojs/nitro/pull/1820))
- **cache:** Set cache item before returning response on first request ([#1813](https://github.com/nitrojs/nitro/pull/1813))

### 💅 Refactors

- **iis:** Improve preset and docs ([#1784](https://github.com/nitrojs/nitro/pull/1784))

### 📖 Documentation

- Update prerender options ([11a24124](https://github.com/nitrojs/nitro/commit/11a24124))
- Fix typo ([#1722](https://github.com/nitrojs/nitro/pull/1722))
- Register error handler using hook instead of `hookOnce` ([#1743](https://github.com/nitrojs/nitro/pull/1743))
- Update lock file ([#1750](https://github.com/nitrojs/nitro/pull/1750))
- Fix typo ([#1759](https://github.com/nitrojs/nitro/pull/1759))
- Fix configuration file name of the custom preset ([#1760](https://github.com/nitrojs/nitro/pull/1760))
- Typo in word "legacy" in Configuration docs ([#1780](https://github.com/nitrojs/nitro/pull/1780))
- **cloudflare:** Add local dev section ([#1772](https://github.com/nitrojs/nitro/pull/1772))

### 🏡 Chore

- **release:** V2.6.3 ([9bb55262](https://github.com/nitrojs/nitro/commit/9bb55262))
- Add `.devcontainer` ([#1633](https://github.com/nitrojs/nitro/pull/1633))
- Update dependencies ([d225d3be](https://github.com/nitrojs/nitro/commit/d225d3be))
- Fix lint issue ([c3565d8c](https://github.com/nitrojs/nitro/commit/c3565d8c))
- Update non-major dependencies ([9c2cab26](https://github.com/nitrojs/nitro/commit/9c2cab26))
- Update lockfile ([179846c7](https://github.com/nitrojs/nitro/commit/179846c7))
- Fix type issues ([0ff72e29](https://github.com/nitrojs/nitro/commit/0ff72e29))
- Update vitest to `1.0.0-beta` ([#1776](https://github.com/nitrojs/nitro/pull/1776))
- Update dependencies ([553e4534](https://github.com/nitrojs/nitro/commit/553e4534))
- **app:** Fix `localFetch` type ([5f3b287c](https://github.com/nitrojs/nitro/commit/5f3b287c))
- Use pnpm `shell-emulator` for windows local development ([#1828](https://github.com/nitrojs/nitro/pull/1828))
- Update lockfile ([f4e33332](https://github.com/nitrojs/nitro/commit/f4e33332))
- Use `nitropack-nightly` for nightly release channel ([#1841](https://github.com/nitrojs/nitro/pull/1841))
- Increase codecov threshold ([bc464032](https://github.com/nitrojs/nitro/commit/bc464032))
- Update lockfile ([f53e3575](https://github.com/nitrojs/nitro/commit/f53e3575))

### ✅ Tests

- Temporarily disable dev test in ci ([53a96adb](https://github.com/nitrojs/nitro/commit/53a96adb))
- Update deno test with explicit host ([8cce5085](https://github.com/nitrojs/nitro/commit/8cce5085))
- Update response type check ([#1839](https://github.com/nitrojs/nitro/pull/1839))

### 🤖 CI

- Run tests against node 18 ([#1713](https://github.com/nitrojs/nitro/pull/1713))
- Run vitest with es and sourcemap support ([c4c00467](https://github.com/nitrojs/nitro/commit/c4c00467))

### ❤️ Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))
- Yasser Lahbibi ([@yassilah](http://github.com/yassilah))
- Horu
- Michael Brevard <yonshi29@gmail.com>
- Daniel Roe <daniel@roe.dev>
- MiniDigger  < Martin>
- Estéban ([@Barbapapazes](http://github.com/Barbapapazes))
- Heb ([@Hebilicious](http://github.com/Hebilicious))
- Henrique Lopes
- McPizza <gh@l1.io>
- Michael BOUVY <michael.bouvy@gmail.com>
- Jeremy Graziani
- Tobias Diez <code@tobiasdiez.com>
- VALERIY SINEVICH
- Roman Zipp <ich@ich.wtf>
- Benjamin GAYMAY ([@BenjaminGaymay](http://github.com/BenjaminGaymay))
- Alexander Lichter ([@manniL](http://github.com/manniL))
- Farnabaz ([@farnabaz](http://github.com/farnabaz))
- Nils K
- Jonas Thelemann ([@dargmuesli](http://github.com/dargmuesli))
- Jenjen75 <jean-michel.khou@vivlab.com>
- Sébastien Chopin ([@Atinux](http://github.com/Atinux))

## v2.6.3

[compare changes](https://github.com/nitrojs/nitro/compare/v2.6.2...v2.6.3)

### 🩹 Fixes

- **firebase:** Apply region for gen2 deployments ([#1657](https://github.com/nitrojs/nitro/pull/1657))
- **cloudflare-pages:** Autodetect static preset ([#1659](https://github.com/nitrojs/nitro/pull/1659))
- Resolve output dirs relative to `rootDir` ([#1666](https://github.com/nitrojs/nitro/pull/1666))
- **prerender:** Allow disabling html sub-folders ([#1676](https://github.com/nitrojs/nitro/pull/1676))
- **firebase:** Use correct key when importing firebase `httpsOptions` ([#1663](https://github.com/nitrojs/nitro/pull/1663))
- Await on `send()` calls ([#1701](https://github.com/nitrojs/nitro/pull/1701))
- Bun dev compatibility ([#1702](https://github.com/nitrojs/nitro/pull/1702))
- **aws-lambda,netlify-lambda:** Binary body v2 and cookies v1 ([#1683](https://github.com/nitrojs/nitro/pull/1683))
- **iis:** Merge `web.config` ([#1658](https://github.com/nitrojs/nitro/pull/1658))

### 📖 Documentation

- **render-com:** Add note about node version ([#1693](https://github.com/nitrojs/nitro/pull/1693))
- Add instructions for using nuxt edge release channel ([#1688](https://github.com/nitrojs/nitro/pull/1688))
- Add instructions for bun ([#1672](https://github.com/nitrojs/nitro/pull/1672))

### 🏡 Chore

- **release:** V2.6.2 ([9d0a383c](https://github.com/nitrojs/nitro/commit/9d0a383c))
- Tiny internal typo ([#1668](https://github.com/nitrojs/nitro/pull/1668))
- Fix code comments ([#1673](https://github.com/nitrojs/nitro/pull/1673))
- Update dependencies ([3134ba6d](https://github.com/nitrojs/nitro/commit/3134ba6d))

### ✅ Tests

- Update test for bun headers ([#1684](https://github.com/nitrojs/nitro/pull/1684))

### ❤️ Contributors

- Gavin Hardaker ([@Hardaker587](http://github.com/Hardaker587))
- Heb ([@Hebilicious](http://github.com/Hebilicious))
- Colin McDonnell ([@colinhacks](http://github.com/colinhacks))
- Pooya Parsa ([@pi0](http://github.com/pi0))
- Luke Nelson <luke@nelson.zone>
- Rajeev R Sharma <i.rarsh@gmail.com>
- Markthree ([@markthree](http://github.com/markthree))
- Daniel Roe <daniel@roe.dev>
- Yuichi Takebe

## v2.6.2

[compare changes](https://github.com/nitrojs/nitro/compare/v2.6.1...v2.6.2)

### 🩹 Fixes

- Use new h3 generics for `defineCachedEventHandler` ([#1640](https://github.com/nitrojs/nitro/pull/1640))
- **aws-lambda, netlify:** Add `isBase64Encoded` response field ([#1645](https://github.com/nitrojs/nitro/pull/1645))
- Exclude typed body from `cachedEventHandler` ([#1647](https://github.com/nitrojs/nitro/pull/1647))
- **static:** Send immediate empty responses for 304 handling ([#1639](https://github.com/nitrojs/nitro/pull/1639))

### 🏡 Chore

- **docs:** Update dependencies ([d4d622c2](https://github.com/nitrojs/nitro/commit/d4d622c2))
- **docs:** Add hotfix for `micromark` import issue ([b1e676e6](https://github.com/nitrojs/nitro/commit/b1e676e6))
- Update lockfile ([fffd8724](https://github.com/nitrojs/nitro/commit/fffd8724))
- Update `listhen` ([62ac3065](https://github.com/nitrojs/nitro/commit/62ac3065))

### ✅ Tests

- Add test for prerender ignored `data:` urls ([#1431](https://github.com/nitrojs/nitro/pull/1431))

### ❤️ Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))
- Markthree ([@markthree](http://github.com/markthree))
- Daniel Roe <daniel@roe.dev>
- Azcray

## v2.6.1

[compare changes](https://github.com/nitrojs/nitro/compare/v2.6.0...v2.6.1)

### 🩹 Fixes

- Correctly mark `middleware: false` for scanned routes ([#1631](https://github.com/nitrojs/nitro/pull/1631))
- Pass relative ignore paths when scanning public assets ([#1632](https://github.com/nitrojs/nitro/pull/1632))

### 🏡 Chore

- Update dependencies ([a779ae79](https://github.com/nitrojs/nitro/commit/a779ae79))
- Force cf pages headers type ([81ec33a0](https://github.com/nitrojs/nitro/commit/81ec33a0))
- Update mlly ([f76f0daa](https://github.com/nitrojs/nitro/commit/f76f0daa))

### ❤️ Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))
- Daniel Roe <daniel@roe.dev>

## v2.6.0

[compare changes](https://github.com/nitrojs/nitro/compare/v2.5.2...v2.6.0)

### 🚀 Enhancements

- **storage:** Default data storage for `node` and dev presets ([#1352](https://github.com/nitrojs/nitro/pull/1352))
- Support regexps in external options ([#1388](https://github.com/nitrojs/nitro/pull/1388))
- Support `exportConditions` and add worker default conditions ([#1401](https://github.com/nitrojs/nitro/pull/1401))
- `event.waitUntil` with cloudflare integration ([#1421](https://github.com/nitrojs/nitro/pull/1421))
- `experimental.typescriptBundlerResolution` flag ([#1384](https://github.com/nitrojs/nitro/pull/1384))
- Support `ignore` to ignore scanned files ([#1430](https://github.com/nitrojs/nitro/pull/1430))
- Allow ignoring public assets with `ignore` options ([#945](https://github.com/nitrojs/nitro/pull/945))
- Add `iis` server preset ([#1436](https://github.com/nitrojs/nitro/pull/1436))
- Auto capture errors with `nitroApp.captureError` ([#1463](https://github.com/nitrojs/nitro/pull/1463))
- **vercel:** Enable streaming support out of the box ([#1514](https://github.com/nitrojs/nitro/pull/1514))
- Fully resolve type paths for auto-import declarations ([#1528](https://github.com/nitrojs/nitro/pull/1528))
- Add `prerender:config`, `prerender:init` and `prerender:done` hooks ([#1519](https://github.com/nitrojs/nitro/pull/1519))
- **cache:** Support cached event handlers with varies ([#1184](https://github.com/nitrojs/nitro/pull/1184))
- **app:** Support `request`, `beforeResponse` and `afterResponse` hooks ([#1545](https://github.com/nitrojs/nitro/pull/1545))
- Experimental composition api via `useEvent()` ans async context support ([#1546](https://github.com/nitrojs/nitro/pull/1546))
- **prerenderer:** Support for query links exploration ([#1474](https://github.com/nitrojs/nitro/pull/1474))
- **cloudflare-pages:** Add config to customize generated `_routes.json` ([#1312](https://github.com/nitrojs/nitro/pull/1312))
- **firebase:** Add support for 2nd generation functions ([#1500](https://github.com/nitrojs/nitro/pull/1500))
- **externals:** Resolve actual subpaths before guessing ([#527](https://github.com/nitrojs/nitro/pull/527))
- **externals:** Support aliasing traced packages ([#1553](https://github.com/nitrojs/nitro/pull/1553))
- **wasm:** Support output esm imports ([#1565](https://github.com/nitrojs/nitro/pull/1565))
- Enable `timing` in debug mode ([#1577](https://github.com/nitrojs/nitro/pull/1577))
- **prerender:** Preserve prerendered asset `content-type` header ([#1587](https://github.com/nitrojs/nitro/pull/1587))
- **externals:** Improved output `package.json` ([#1607](https://github.com/nitrojs/nitro/pull/1607))
- **firebase:** Support renaming exported server function ([#1377](https://github.com/nitrojs/nitro/pull/1377))
- **azure:** Support custom configuration ([#1344](https://github.com/nitrojs/nitro/pull/1344))
- **node-server:** Support listening to unix sockets using `NITRO_UNIX_SOCKET` ([#1201](https://github.com/nitrojs/nitro/pull/1201))
- **cloudflare-module, cloudflare-pages:** Experimental dynamic imports ([#1172](https://github.com/nitrojs/nitro/pull/1172))
- **cli:** Support `--preset` and `--minify`/`--no-minify` args for `build` ([#1621](https://github.com/nitrojs/nitro/pull/1621))
- **cli:** Add listhen options for `dev` command ([#1622](https://github.com/nitrojs/nitro/pull/1622))
- Handle stream and Uint8Array for lambda presets ([#1624](https://github.com/nitrojs/nitro/pull/1624))

### 🔥 Performance

- Use `fsLite` driver for production `data:` storage ([dd290763](https://github.com/nitrojs/nitro/commit/dd290763))
- Use inline http-graceful-shoutdown to reduce externals ([8053cca0](https://github.com/nitrojs/nitro/commit/8053cca0))
- Remove `source-map-support` as node supports `--enable-source-maps` ([9ba8fe98](https://github.com/nitrojs/nitro/commit/9ba8fe98))
- Bundle runtime dependencies ([#1554](https://github.com/nitrojs/nitro/pull/1554))
- Use local fetch for proxy route rules ([#1609](https://github.com/nitrojs/nitro/pull/1609))

### 🩹 Fixes

- **rollup:** Replace `globalThis.process.` with `process.` ([#1360](https://github.com/nitrojs/nitro/pull/1360))
- **types:** Enable `allowSyntheticDefaultImports` option by default ([#1383](https://github.com/nitrojs/nitro/pull/1383))
- **cache:** Try to call `event.waitUntil` ([#1422](https://github.com/nitrojs/nitro/pull/1422))
- **defineCachedFunction:** Properly infer function type ([#1423](https://github.com/nitrojs/nitro/pull/1423))
- **static:** Safe decode path ([#1459](https://github.com/nitrojs/nitro/pull/1459))
- Split cookie headers ([#1452](https://github.com/nitrojs/nitro/pull/1452))
- **deno-deploy:** Treat all `https://` modules as external ([#1438](https://github.com/nitrojs/nitro/pull/1438))
- **cache:** Call `event.waitUntil` on main resolver when expired ([421d6255](https://github.com/nitrojs/nitro/commit/421d6255))
- **prerender:** Skip redirects ([#1448](https://github.com/nitrojs/nitro/pull/1448))
- **aws-lambda,netlify:** Base64 encode binary responses ([#1274](https://github.com/nitrojs/nitro/pull/1274))
- **app:** Enable router preemptive mode ([#1504](https://github.com/nitrojs/nitro/pull/1504))
- **vercel:** Allow arbitrary  function configuration ([#1508](https://github.com/nitrojs/nitro/pull/1508))
- Use relative paths in `tsconfig.json` ([#1518](https://github.com/nitrojs/nitro/pull/1518))
- **prerender:** Free up memory after each route is written to the disk ([#1536](https://github.com/nitrojs/nitro/pull/1536))
- **prerender:** Call `prerender:route` before freeing up memory ([#1537](https://github.com/nitrojs/nitro/pull/1537))
- **prerender:** Only match `href` attribute after whitespace ([#1530](https://github.com/nitrojs/nitro/pull/1530))
- **externals:** Absolute paths are inlined ([#1429](https://github.com/nitrojs/nitro/pull/1429))
- **openapi:** Merge handlers with same route and different method ([#1497](https://github.com/nitrojs/nitro/pull/1497))
- **prerender:** Exclude encoded `href` attributes from link extraction ([#1485](https://github.com/nitrojs/nitro/pull/1485))
- **externals:** Increase score for npm package name patterns to avoid breaking changes ([#1548](https://github.com/nitrojs/nitro/pull/1548))
- **deno-deploy:** Decode static asset path before reading from filesystem ([#1494](https://github.com/nitrojs/nitro/pull/1494))
- Remove non-standard `module` export condition ([#1559](https://github.com/nitrojs/nitro/pull/1559))
- **externals:** Trace externals with their commonjs / esm status ([#1562](https://github.com/nitrojs/nitro/pull/1562))
- Use relative paths in generated tsconfig ([#1572](https://github.com/nitrojs/nitro/pull/1572))
- **app:** Use `event.path` instead of `event.url` ([41a76c0f](https://github.com/nitrojs/nitro/commit/41a76c0f))
- **cache:** Don't use `_originalPath` ([#1576](https://github.com/nitrojs/nitro/pull/1576))
- **types:** Use relative type path to nitro `#internal/nitro` ([#1584](https://github.com/nitrojs/nitro/pull/1584))
- Disable sourcemap minify for dev ([e38f3586](https://github.com/nitrojs/nitro/commit/e38f3586))
- Use relative source map paths and add test ([#1582](https://github.com/nitrojs/nitro/pull/1582))
- **pkg:** Remove node 14 from supported `engines` ([#1585](https://github.com/nitrojs/nitro/pull/1585))
- **prerender:** Use decoded asset id to access prerendered asset header overrides ([#1588](https://github.com/nitrojs/nitro/pull/1588))
- Add `consola/core` alias ([#1591](https://github.com/nitrojs/nitro/pull/1591))
- **vercel,netlify:** Don't deprecate `swr` when `cache: false` ([#1603](https://github.com/nitrojs/nitro/pull/1603))
- **build:** Workaround bun's difference in `function.toString()` ([#1606](https://github.com/nitrojs/nitro/pull/1606))
- **firebase:** Ignore `fsevent` dependency ([#1610](https://github.com/nitrojs/nitro/pull/1610))
- Directly pass `localFetch` to route rules handler ([#1611](https://github.com/nitrojs/nitro/pull/1611))
- **stormkit:** Properly send buffer responses ([#1616](https://github.com/nitrojs/nitro/pull/1616))
- Add parent `node_modules` of nitro to modules dir for pnpm compat ([#1618](https://github.com/nitrojs/nitro/pull/1618))
- **deno-server:** Fix injections and enable back tests ([#1625](https://github.com/nitrojs/nitro/pull/1625))

### 💅 Refactors

- **cloudflare:** Use `wrangler deploy` instead of `publish` ([#1372](https://github.com/nitrojs/nitro/pull/1372))
- **cloudflare:** Use `wrangler deploy` in more places ([#1393](https://github.com/nitrojs/nitro/pull/1393))
- Add internal types for public assets ([#1460](https://github.com/nitrojs/nitro/pull/1460))
- **prerender:** Improve console formatting for failed routes ([#1471](https://github.com/nitrojs/nitro/pull/1471))
- Reduce usage of `event.node.req` ([#1511](https://github.com/nitrojs/nitro/pull/1511))
- Reduce usage of `event.node.res` ([#1513](https://github.com/nitrojs/nitro/pull/1513))
- **timing:** Hide debug logs with 0ms ([8a44d19c](https://github.com/nitrojs/nitro/commit/8a44d19c))
- **firebase:** Update generated `package.json` ([#1608](https://github.com/nitrojs/nitro/pull/1608))
- Migrate from `http-proxy` to `unjs/httpxy` ([#1623](https://github.com/nitrojs/nitro/pull/1623))
- Simplify `normalizeLambdaOutgoingBody` ([58b4853b](https://github.com/nitrojs/nitro/commit/58b4853b))
- Expose body type for lambda presets ([e5f095d6](https://github.com/nitrojs/nitro/commit/e5f095d6))

### 📖 Documentation

- **vercel:** Add note about top level `api/` directory ([#1386](https://github.com/nitrojs/nitro/pull/1386))
- Upgrade Docus ([26dd16a0](https://github.com/nitrojs/nitro/commit/26dd16a0))
- Update nitro ([1a14a312](https://github.com/nitrojs/nitro/commit/1a14a312))
- Fix crawler error ([c5e53cc8](https://github.com/nitrojs/nitro/commit/c5e53cc8))
- Update ([03540d98](https://github.com/nitrojs/nitro/commit/03540d98))
- Add nitro plugins examples ([#1403](https://github.com/nitrojs/nitro/pull/1403))
- Add custom preset instructions ([#1409](https://github.com/nitrojs/nitro/pull/1409))
- **aws:** Add note about inlining dynamic chunks ([#650](https://github.com/nitrojs/nitro/pull/650))
- Fixed typo of the word `discussions` ([#1433](https://github.com/nitrojs/nitro/pull/1433))
- Fix typo ([#1446](https://github.com/nitrojs/nitro/pull/1446))
- Use `defineEventHandler` instead of `eventHandler` ([#1442](https://github.com/nitrojs/nitro/pull/1442))
- Remove auto-imported `defineNitroConfig` ([#1441](https://github.com/nitrojs/nitro/pull/1441))
- Add utils directory ([#1451](https://github.com/nitrojs/nitro/pull/1451))
- **storage:** Add runtime storage configuration examples ([#1456](https://github.com/nitrojs/nitro/pull/1456))
- Prefer snake_case for preset names ([#1499](https://github.com/nitrojs/nitro/pull/1499))
- **routing:** Add middleware section ([#1307](https://github.com/nitrojs/nitro/pull/1307))
- **plugins:** Add runtime hooks section ([#1521](https://github.com/nitrojs/nitro/pull/1521))
- **config:** Add runtime config and environment variables section ([#1550](https://github.com/nitrojs/nitro/pull/1550))
- **firebase:** Improve docs ([#1556](https://github.com/nitrojs/nitro/pull/1556))
- **cloudflare:** Add environment variables instructions ([#1547](https://github.com/nitrojs/nitro/pull/1547))

### 📦 Build

- Upgrade to unbuild v2 ([27f2cc48](https://github.com/nitrojs/nitro/commit/27f2cc48))

### 🏡 Chore

- **release:** V2.5.2 ([b8b6defe](https://github.com/nitrojs/nitro/commit/b8b6defe))
- Update lockfile ([976ec35c](https://github.com/nitrojs/nitro/commit/976ec35c))
- Update references to `nuxt/nuxt` ([#1465](https://github.com/nitrojs/nitro/pull/1465))
- Update github templates ([#1502](https://github.com/nitrojs/nitro/pull/1502))
- Typo in bug report template ([#1507](https://github.com/nitrojs/nitro/pull/1507))
- Update dependencies ([#1509](https://github.com/nitrojs/nitro/pull/1509))
- Upgrade to `h3@1.8-rc` ([#1510](https://github.com/nitrojs/nitro/pull/1510))
- Add codeql ci ([#1542](https://github.com/nitrojs/nitro/pull/1542))
- Add `security.md` ([30b3578e](https://github.com/nitrojs/nitro/commit/30b3578e))
- Update lockfile ([fc555506](https://github.com/nitrojs/nitro/commit/fc555506))
- Update h3 ([bdf91c55](https://github.com/nitrojs/nitro/commit/bdf91c55))
- Update dependencies ([de6d2d0b](https://github.com/nitrojs/nitro/commit/de6d2d0b))
- **firebase:** Fix typos in warning message ([#1561](https://github.com/nitrojs/nitro/pull/1561))
- Update dependencies ([e86f1464](https://github.com/nitrojs/nitro/commit/e86f1464))
- Lint test files as well ([#1589](https://github.com/nitrojs/nitro/pull/1589))
- Update dependencies ([6cb72e69](https://github.com/nitrojs/nitro/commit/6cb72e69))
- Update dependencies ([8aa94ad2](https://github.com/nitrojs/nitro/commit/8aa94ad2))
- Update dependencies ([8d7e6607](https://github.com/nitrojs/nitro/commit/8d7e6607))
- Update dependencies ([b4d86b25](https://github.com/nitrojs/nitro/commit/b4d86b25))
- Remove accidental console log ([2ece2a3a](https://github.com/nitrojs/nitro/commit/2ece2a3a))

### ✅ Tests

- Improve external modules test ([#1428](https://github.com/nitrojs/nitro/pull/1428))
- Run tests even if not `serveStatic` ([#1590](https://github.com/nitrojs/nitro/pull/1590))
- Add tests for environment variables and runtime config overrides ([#1549](https://github.com/nitrojs/nitro/pull/1549))
- Fix netlify tests ([880c20e4](https://github.com/nitrojs/nitro/commit/880c20e4))
- **netlify:** Run after ([8a6ed77b](https://github.com/nitrojs/nitro/commit/8a6ed77b))
- Fix netlify dirs ([8c7ca39d](https://github.com/nitrojs/nitro/commit/8c7ca39d))

### 🤖 CI

- Use conventional commit message for autofix ([#1501](https://github.com/nitrojs/nitro/pull/1501))
- Use `h3-nightly@latest` for edge releases ([#1563](https://github.com/nitrojs/nitro/pull/1563))
- Avoid installing with edge dependency changes ([c431b719](https://github.com/nitrojs/nitro/commit/c431b719))

### ❤️ Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))
- Daniel Roe <daniel@roe.dev>
- Utsob Roy ([@uroybd](http://github.com/uroybd))
- Nick Dawson
- AlexLavoie42 ([@AlexLavoie42](http://github.com/AlexLavoie42))
- Heb ([@Hebilicious](http://github.com/Hebilicious))
- Dave Caruso ([@paperdave](http://github.com/paperdave))
- Anthony Fu <anthonyfu117@hotmail.com>
- Luke Nelson <luke@nelson.zone>
- Eduardo San Martin Morote
- Asher White ([@AWBroch](http://github.com/AWBroch))
- Nikhil Saraf ([@nksaraf](http://github.com/nksaraf))
- Velka
- Andreas Botzler <andreas.botzler@googlemail.com>
- Farnabaz <farnabaz@gmail.com>
- Leo Bourbon
- Gnoeley <leonpelech@gmail.com>
- Estéban ([@Barbapapazes](http://github.com/Barbapapazes))
- Marshall Thompson ([@marshallswain](http://github.com/marshallswain))
- Harlan Wilton ([@harlan-zw](http://github.com/harlan-zw))
- Qin Guan <qinguan20040914@gmail.com>
- Aaron Dewes <aaron@runcitadel.space>
- Ccccccjh
- Antony Konstantinidis <ak@digitalessence.de>
- Arjun-re
- Morty Li <a0988891318@gmail.com>
- Hebilicious ([@Hebilicious](http://github.com/Hebilicious))
- Sébastien Chopin ([@Atinux](http://github.com/Atinux))
- Rieger
- James Ross ([@Cherry](http://github.com/Cherry))

## v2.5.2

[compare changes](https://github.com/nitrojs/nitro/compare/v2.5.1...v2.5.2)


### 🩹 Fixes

  - Add `envPrefix` to `runtimeConfig.nitro` types ([#1336](https://github.com/nitrojs/nitro/pull/1336))
  - **prerender:** Allow to fetch static files ([#1340](https://github.com/nitrojs/nitro/pull/1340))
  - **options:** Default target to `static` when `static` override is set ([#1342](https://github.com/nitrojs/nitro/pull/1342))
  - Correct default `node-server`  target ([7976318](https://github.com/nitrojs/nitro/commit/7976318))
  - **vercel, netlify:** Always check `nativeSWR` future flag ([ccebe4e](https://github.com/nitrojs/nitro/commit/ccebe4e))
  - **vercel, netlify:** Handle boolean values for route rule deprecation ([dfd8bbd](https://github.com/nitrojs/nitro/commit/dfd8bbd))
  - Dedup `unstorage` dependency and use subpath alias ([#1164](https://github.com/nitrojs/nitro/pull/1164))
  - **dev:** Ensure socket path is accessible ([#1115](https://github.com/nitrojs/nitro/pull/1115))
  - Type `event.$fetch` and `event.fetch` ([#1343](https://github.com/nitrojs/nitro/pull/1343))
  - Allow configuring esbuild transform plugin ([#1347](https://github.com/nitrojs/nitro/pull/1347))

### 📖 Documentation

  - Add reference to install azure functions core tools to the swa section ([#1339](https://github.com/nitrojs/nitro/pull/1339))

### 🏡 Chore

  - **release:** V2.5.1 ([21a2595](https://github.com/nitrojs/nitro/commit/21a2595))
  - Add `.data` to gitignore ([cff7bf0](https://github.com/nitrojs/nitro/commit/cff7bf0))
  - Update deps and lockfile ([373f34c](https://github.com/nitrojs/nitro/commit/373f34c))
  - Update unimport ([ef7eaf2](https://github.com/nitrojs/nitro/commit/ef7eaf2))

### ❤️  Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))
- Daniel Roe <daniel@roe.dev>
- Stefan Bittmann <stefan@clinic.tools>
- Nick Dawson

## v2.5.1

[compare changes](https://github.com/nitrojs/nitro/compare/v2.5.0...v2.5.1)


### 📖 Documentation

  - Fix typo in Flightcontrol deployment option ([#1332](https://github.com/nitrojs/nitro/pull/1332))

### 📦 Build

  - Avoid doubly-bundling runtime types ([#1334](https://github.com/nitrojs/nitro/pull/1334))

### 🌊 Types

  - Avoid overriding app runtime config namespace ([#1333](https://github.com/nitrojs/nitro/pull/1333))

### ❤️  Contributors

- Daniel Roe <daniel@roe.dev>
- ModupeD

## v2.5.0

[compare changes](https://github.com/nitrojs/nitro/compare/v0.0.2...v2.5.0)


### 🚀 Enhancements

  - Allow customising generated tsConfig ([#1266](https://github.com/nitrojs/nitro/pull/1266))
  - Type `useRuntimeConfig` with `NitroRuntimeConfig` ([#1311](https://github.com/nitrojs/nitro/pull/1311))
  - Type nitro app runtime hooks ([#1316](https://github.com/nitrojs/nitro/pull/1316))
  - Add `cloudflare-pages-static` preset ([#1310](https://github.com/nitrojs/nitro/pull/1310))
  - Add experimental `deno-server` preset ([#592](https://github.com/nitrojs/nitro/pull/592))
  - Add `flightcontrol` preset ([#970](https://github.com/nitrojs/nitro/pull/970), [#1250](https://github.com/nitrojs/nitro/pull/1250))
  - Support `jsx` and `tsx` out of the box ([#1303](https://github.com/nitrojs/nitro/pull/1303))
  - Add support for `failOnError` ([#1294](https://github.com/nitrojs/nitro/pull/1294))
  - UseStorage generic support ([#1279](https://github.com/nitrojs/nitro/pull/1279))
  - Provide static `process.*` and `import.meta.*` build flags ([#1331](https://github.com/nitrojs/nitro/pull/1331))

### 🩹 Fixes

  - **bun:** Resolve internal dependencies with `bun` export condition ([#1313](https://github.com/nitrojs/nitro/pull/1313))
  - **deno:** Support environment variables ([88b4e11](https://github.com/nitrojs/nitro/commit/88b4e11))
  - Respect `static` flag when auto detecting preset ([#1321](https://github.com/nitrojs/nitro/pull/1321))
  - **prerenderer:** Don't inherit `static` config ([#1324](https://github.com/nitrojs/nitro/pull/1324))
  - **vercel:** Add check for index route rule ([#1290](https://github.com/nitrojs/nitro/pull/1290))
  - Use `event.handled` guard before sending direct responses ([#1326](https://github.com/nitrojs/nitro/pull/1326))
  - Import `NitroRuntimeHooks` from runtime dir ([#1328](https://github.com/nitrojs/nitro/pull/1328))
  - Generate types for `#imports` ([#1329](https://github.com/nitrojs/nitro/pull/1329))

### 📖 Documentation

  - Update docus version ([848c86a](https://github.com/nitrojs/nitro/commit/848c86a))
  - Update cloudflare-pages preset ([#1304](https://github.com/nitrojs/nitro/pull/1304))
  - Add an example for `devHandlers` config ([#1295](https://github.com/nitrojs/nitro/pull/1295))

### 🏡 Chore

  - Update dependencies ([db93afa](https://github.com/nitrojs/nitro/commit/db93afa))
  - Apply new lint rules ([879a7c3](https://github.com/nitrojs/nitro/commit/879a7c3))
  - Update all non major dependencies ([9bb674f](https://github.com/nitrojs/nitro/commit/9bb674f))
  - Update dependencies ([46e6f10](https://github.com/nitrojs/nitro/commit/46e6f10))
  - Update unstorage ([bac3b0d](https://github.com/nitrojs/nitro/commit/bac3b0d))

### ❤️  Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))
- 魔王少年 ([@maou-shonen](http://github.com/maou-shonen))
- Daniel Roe <daniel@roe.dev>
- Andrew <mshote@gmail.com>
- Estéban ([@Barbapapazes](http://github.com/Barbapapazes))
- Dunqing ([@Dunqing](http://github.com/Dunqing))
- Frantz Kati <bahdcoder@gmail.com>
- Mike Laumann Bellika
- Sébastien Chopin ([@Atinux](http://github.com/Atinux))
- Hebilicious ([@Hebilicious](http://github.com/Hebilicious))

## v2.4.0

[compare changes](https://github.com/nitrojs/nitro/compare/v2.3.3...v2.4.0)


### 🚀 Enhancements

  - Add cloudflare module worker support ([#681](https://github.com/nitrojs/nitro/pull/681))
  - **vercel, netlify:** Introduce `isr` route rule ([#1124](https://github.com/nitrojs/nitro/pull/1124))
  - Add `static` preset ([#1127](https://github.com/nitrojs/nitro/pull/1127))
  - Add `vercel-static` and `netlify-static` presets ([#1073](https://github.com/nitrojs/nitro/pull/1073))
  - Add `github-pages` preset ([#1133](https://github.com/nitrojs/nitro/pull/1133))
  - Pass resolved config to `rollup:before` hook ([#1160](https://github.com/nitrojs/nitro/pull/1160))
  - Config reload support for `nitro dev` ([#1173](https://github.com/nitrojs/nitro/pull/1173))
  - Config hmr support for `routeRules` and `rutimeConfig` ([#1175](https://github.com/nitrojs/nitro/pull/1175))
  - Support dynamic app config and runtime config ([#1154](https://github.com/nitrojs/nitro/pull/1154))
  - Experimental `/_nitro/openapi.json` and `/_nitro/swagger` for dev mode ([#1162](https://github.com/nitrojs/nitro/pull/1162))
  - **vercel:** Add support for specifying edge regions ([#1192](https://github.com/nitrojs/nitro/pull/1192))
  - `future.nativeSWR` ([#1212](https://github.com/nitrojs/nitro/pull/1212))

### 🔥 Performance

  - Export `defineNitroConfig` from `nitro/config` ([#1174](https://github.com/nitrojs/nitro/pull/1174))

### 🩹 Fixes

  - Separate `typesDir` from `tsConfigDir` ([#1146](https://github.com/nitrojs/nitro/pull/1146))
  - **cloudflare:** Expose env from module context ([#1147](https://github.com/nitrojs/nitro/pull/1147))
  - **proxy:** Append request query params for single proxy route rules ([#1163](https://github.com/nitrojs/nitro/pull/1163))
  - **vercel, netlify:** Keep default behavior for `static` and `swr` to `isr` mapping ([#1155](https://github.com/nitrojs/nitro/pull/1155))
  - Apply `chunkFileNames` on windows ([#1189](https://github.com/nitrojs/nitro/pull/1189))
  - **pkg:** Allow installing on node v20 and above ([#1204](https://github.com/nitrojs/nitro/pull/1204))

### 💅 Refactors

  - Rename `build` option to `static` ([#1144](https://github.com/nitrojs/nitro/pull/1144))
  - **cli:** Migrate to citty ([#1157](https://github.com/nitrojs/nitro/pull/1157))
  - Move swagger/openapi behind experimental flag ([2079cab](https://github.com/nitrojs/nitro/commit/2079cab))

### 📖 Documentation

  - Fix typo ([#1131](https://github.com/nitrojs/nitro/pull/1131))
  - Update serverAssets example ([#1156](https://github.com/nitrojs/nitro/pull/1156))
  - Add edge releases channel ([2793f51](https://github.com/nitrojs/nitro/commit/2793f51))
  - **get-started:** H2 instead of h3 ([ff3964e](https://github.com/nitrojs/nitro/commit/ff3964e))
  - **routing:** Add route rules ([46740e6](https://github.com/nitrojs/nitro/commit/46740e6))
  - **routing:** Add missing import ([30675d4](https://github.com/nitrojs/nitro/commit/30675d4))
  - Fix syntax issue in guide > storage ([#1180](https://github.com/nitrojs/nitro/pull/1180))
  - Update ([1e5bb86](https://github.com/nitrojs/nitro/commit/1e5bb86))
  - Fix typo ([#1185](https://github.com/nitrojs/nitro/pull/1185))
  - Fix typo ([#1190](https://github.com/nitrojs/nitro/pull/1190))
  - **vercel:** Add vercel kv storage section ([#1210](https://github.com/nitrojs/nitro/pull/1210))
  - Update branding ([#1188](https://github.com/nitrojs/nitro/pull/1188))
  - Update vercel-storage ([ffff9db](https://github.com/nitrojs/nitro/commit/ffff9db))

### 🏡 Chore

  - Update dependencies ([39d1f27](https://github.com/nitrojs/nitro/commit/39d1f27))
  - **release:** V2.3.3 ([2d55caf](https://github.com/nitrojs/nitro/commit/2d55caf))
  - Update dependencies and lockfile ([eea8943](https://github.com/nitrojs/nitro/commit/eea8943))
  - Update unenv ([ba81902](https://github.com/nitrojs/nitro/commit/ba81902))
  - Update lockfile ([6a4e57e](https://github.com/nitrojs/nitro/commit/6a4e57e))
  - Update lockfile ([0793451](https://github.com/nitrojs/nitro/commit/0793451))
  - **docs:** Move `vercel.json` ([00502d0](https://github.com/nitrojs/nitro/commit/00502d0))
  - **docs:** Update deps ([4a95c96](https://github.com/nitrojs/nitro/commit/4a95c96))
  - Update deps ([6b08d37](https://github.com/nitrojs/nitro/commit/6b08d37))

### ✅ Tests

  - Enable `vercel-edge` test ([7951532](https://github.com/nitrojs/nitro/commit/7951532))

### ❤️  Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))
- Sébastien Chopin ([@Atinux](http://github.com/Atinux))
- Daniel Roe <daniel@roe.dev>
- AaronBeaudoin <aaronjbeaudoin@gmail.com>
- Oumar Barry ([@oumarbarry](http://github.com/oumarbarry))
- G-Cyrille
- 魔王少年 <q267009886.work@gmail.com>
- Iho Somnam <ihosomnam4741@gmail.com>
- Timhanlon <tim@timhanlon.com>

## v2.3.3

[compare changes](https://github.com/nitrojs/nitro/compare/v2.3.2...v2.3.3)


### 🚀 Enhancements

  - Upgrade to consola v3 (prerelease) ([50e9f8e](https://github.com/nitrojs/nitro/commit/50e9f8e))

### 🩹 Fixes

  - **prerender:** Show generated routes with error in logs ([8e06f2e](https://github.com/nitrojs/nitro/commit/8e06f2e))
  - **prerender:** Respect output path from main preset ([#1114](https://github.com/nitrojs/nitro/pull/1114))

### 📖 Documentation

  - Fix typos in storage and cache guides ([#1086](https://github.com/nitrojs/nitro/pull/1086))
  - Use unjs logo ([#1104](https://github.com/nitrojs/nitro/pull/1104))
  - Fix typo in cachedEventHandler options ([#1110](https://github.com/nitrojs/nitro/pull/1110))
  - Use consistent quotes in the routeRules example ([#1108](https://github.com/nitrojs/nitro/pull/1108))
  - Fix typo in server assets mount point ([#1119](https://github.com/nitrojs/nitro/pull/1119))
  - Improve `publicAssets` config details ([#1102](https://github.com/nitrojs/nitro/pull/1102))

### 🏡 Chore

  - **doc:** Fix small typo in plugin filename ([#1081](https://github.com/nitrojs/nitro/pull/1081))
  - Update unenv and semver ([363e2ea](https://github.com/nitrojs/nitro/commit/363e2ea))
  - Update consola ([5d77615](https://github.com/nitrojs/nitro/commit/5d77615))
  - Bump to consola v3 stable ([ea5ea88](https://github.com/nitrojs/nitro/commit/ea5ea88))
  - Update dependencies ([39d1f27](https://github.com/nitrojs/nitro/commit/39d1f27))

### ❤️  Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))
- Gabriel Cipriano ([@gabrielcipriano](http://github.com/gabrielcipriano))
- Daniel Roe <daniel@roe.dev>
- Yassine El Ouazzani ([@kwarkjes](http://github.com/kwarkjes))
- Inesh Bose
- Andre Hammons
- Michael BOUVY <michael.bouvy@gmail.com>

## v2.3.2

[compare changes](https://github.com/nitrojs/nitro/compare/v2.3.1...v2.3.2)


### 🩹 Fixes

  - Sanitize `statusMessage` of disallowed chars ([#1057](https://github.com/nitrojs/nitro/pull/1057))
  - **types:** Sync vercel build config types ([#1056](https://github.com/nitrojs/nitro/pull/1056))
  - **azure:** Support custom baseURL ([#1062](https://github.com/nitrojs/nitro/pull/1062))
  - **vercel-edge:** Fix route generation ([#1071](https://github.com/nitrojs/nitro/pull/1071))
  - Mark `options.renderer` as optional ([#1069](https://github.com/nitrojs/nitro/pull/1069))
  - **types:** Make $Fetch types less complex ([#1059](https://github.com/nitrojs/nitro/pull/1059))

### 💅 Refactors

  - Add type safety to auto-detected providers ([#1072](https://github.com/nitrojs/nitro/pull/1072))

### 📖 Documentation

  - Fixed link path ([#1053](https://github.com/nitrojs/nitro/pull/1053))
  - Fix typo ([#1068](https://github.com/nitrojs/nitro/pull/1068))
  - **routing:** Add `$fetch` usage note ([#1070](https://github.com/nitrojs/nitro/pull/1070))

### ❤️  Contributors

- Mahdi Boomeri <mahdi@boomeri.dev>
- Daniel Roe <daniel@roe.dev>
- Shohei Maeda
- Lucas ([@Draichi](http://github.com/Draichi))
- Nobkd
- Honza Pobořil <honza@poboril.cz>

## v2.3.1

[compare changes](https://github.com/nitrojs/nitro/compare/v2.3.0...v2.3.1)


### 🩹 Fixes

  - **types:** Don't simplify type of serialized return ([#1050](https://github.com/nitrojs/nitro/pull/1050))

### 🏡 Chore

  - Add `codecov.yml` ([6fe7f64](https://github.com/nitrojs/nitro/commit/6fe7f64))

### ❤️  Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))
- Daniel Roe <daniel@roe.dev>

## v2.3.0

[compare changes](https://github.com/nitrojs/nitro/compare/v2.2.3...v2.3.0)


### 🚀 Enhancements

  - **vercel:** Add functions config ([#976](https://github.com/nitrojs/nitro/pull/976))
  - Add support for `sourceMap` values `hidden`  and `inline` ([#998](https://github.com/nitrojs/nitro/pull/998))
  - **lagon:** Write `.lagon/config.json` on build ([#996](https://github.com/nitrojs/nitro/pull/996))
  - **types:** Type $fetch to match json serialization output ([#1002](https://github.com/nitrojs/nitro/pull/1002))
  - Support base in `useStorage(base?: string)` and improve docs ([#1012](https://github.com/nitrojs/nitro/pull/1012))
  - **cloudflare-pages:** Rewrite with module syntax ([#1004](https://github.com/nitrojs/nitro/pull/1004))
  - Allow customising generated tsconfig path ([#1021](https://github.com/nitrojs/nitro/pull/1021))
  - Support app config ([#1022](https://github.com/nitrojs/nitro/pull/1022))

### 🩹 Fixes

  - **cloudflare-pages:** Only allow 100 rules combined ([#973](https://github.com/nitrojs/nitro/pull/973))
  - Only mock `debug` in production ([#990](https://github.com/nitrojs/nitro/pull/990))
  - Scan middleware and print tree list in ascending alphabetical order ([#981](https://github.com/nitrojs/nitro/pull/981))
  - **externals:** Correctly specify multiple external dependencies in package.json ([#1013](https://github.com/nitrojs/nitro/pull/1013))
  - **static:** Use correct format for last modified ([#1017](https://github.com/nitrojs/nitro/pull/1017))
  - **cache:** Remove rejected cache promise from pending list. ([#995](https://github.com/nitrojs/nitro/pull/995))
  - Expose `useStorage` with types ([#1026](https://github.com/nitrojs/nitro/pull/1026))
  - **prerender:** Allow spaces in `href` value regex ([#1030](https://github.com/nitrojs/nitro/pull/1030))
  - **cache:** Use stale value by default when `swr` is enabled ([#1038](https://github.com/nitrojs/nitro/pull/1038))
  - Resolve types relative to custom tsconfig path ([#1041](https://github.com/nitrojs/nitro/pull/1041))
  - Remove duplicate import in generated code ([#1043](https://github.com/nitrojs/nitro/pull/1043))
  - **types:** Exclude non serializable options from route rules ([#1047](https://github.com/nitrojs/nitro/pull/1047))

### 💅 Refactors

  - Use unimport built-in type gen for dirs ([#994](https://github.com/nitrojs/nitro/pull/994))
  - Split out api types ([#1027](https://github.com/nitrojs/nitro/pull/1027))

### 📖 Documentation

  - Update to latest docus and various improvements ([#975](https://github.com/nitrojs/nitro/pull/975))
  - Up docus and add back ellipsis ([38b1f34](https://github.com/nitrojs/nitro/commit/38b1f34))
  - Remove tailwind module ([b3b7e87](https://github.com/nitrojs/nitro/commit/b3b7e87))
  - **lock:** Update ([7efa31f](https://github.com/nitrojs/nitro/commit/7efa31f))
  - More improvements ([#985](https://github.com/nitrojs/nitro/pull/985))
  - Remove fluid layout ([d83f2b6](https://github.com/nitrojs/nitro/commit/d83f2b6))
  - Update color ([18674c5](https://github.com/nitrojs/nitro/commit/18674c5))
  - Add unjs icon in footer ([6d36ceb](https://github.com/nitrojs/nitro/commit/6d36ceb))
  - Update docus ([5fcc127](https://github.com/nitrojs/nitro/commit/5fcc127))
  - Add button to open on CodeSandBox ([ad120ac](https://github.com/nitrojs/nitro/commit/ad120ac))
  - Update deployment example for configuration ([#972](https://github.com/nitrojs/nitro/pull/972))
  - Update dependencies ([c923fed](https://github.com/nitrojs/nitro/commit/c923fed))
  - **cache:** Improve documentation and `cachedFunction` default options ([#1011](https://github.com/nitrojs/nitro/pull/1011))
  - Improve readme and getting started ([94d95fa](https://github.com/nitrojs/nitro/commit/94d95fa))
  - Fix on mobile long path ([1d2f57e](https://github.com/nitrojs/nitro/commit/1d2f57e))
  - Improvements ([f78619f](https://github.com/nitrojs/nitro/commit/f78619f))
  - Add `prerender.ignore` description ([#1032](https://github.com/nitrojs/nitro/pull/1032))
  - Improve configuration page ([554b358](https://github.com/nitrojs/nitro/commit/554b358))
  - Improve plugins section ([f36a6e0](https://github.com/nitrojs/nitro/commit/f36a6e0))
  - Update readme ([c58a764](https://github.com/nitrojs/nitro/commit/c58a764))
  - Update homepage hero ([b848e5a](https://github.com/nitrojs/nitro/commit/b848e5a))
  - Update meta tags ([70f00e5](https://github.com/nitrojs/nitro/commit/70f00e5))
  - More improvements ([#1039](https://github.com/nitrojs/nitro/pull/1039))
  - Update docus version ([f31240b](https://github.com/nitrojs/nitro/commit/f31240b))
  - Upgrade docus ([a6ce587](https://github.com/nitrojs/nitro/commit/a6ce587))
  - **deploy/workers:** Fix typo of bundle ([#1046](https://github.com/nitrojs/nitro/pull/1046))

### 🏡 Chore

  - **readme:** Various improvements ([#1009](https://github.com/nitrojs/nitro/pull/1009))
  - Fix tests ([#1014](https://github.com/nitrojs/nitro/pull/1014))
  - **docs:** Use pnpm ([39f117a](https://github.com/nitrojs/nitro/commit/39f117a))
  - Add autofix-ci action ([8f9c3e2](https://github.com/nitrojs/nitro/commit/8f9c3e2))
  - Remove old docs commands ([#1042](https://github.com/nitrojs/nitro/pull/1042))
  - Update dependencies ([02c48f2](https://github.com/nitrojs/nitro/commit/02c48f2))
  - Maintain lockfile ([ac81602](https://github.com/nitrojs/nitro/commit/ac81602))
  - Use single undici version for testing ([00743bc](https://github.com/nitrojs/nitro/commit/00743bc))

### ❤️  Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))
- Daniel Roe <daniel@roe.dev>
- Felix De Montis <hi@felix.dm>
- Sébastien Chopin ([@Atinux](http://github.com/Atinux))
- Hannes Küttner <kuettner.hannes@gmail.com>
- Julie Saia
- Ted De Koning
- Jan Johansen <nizopezo@gmail.com>
- Tobias Diez <code@tobiasdiez.com>
- Elian ☕️ <hello@elian.codes>
- Mahdi Boomeri <mahdi@boomeri.dev>
- Anthony Fu <anthonyfu117@hotmail.com>
- Tom Lienard ([@QuiiBz](http://github.com/QuiiBz))
- Alex Korytskyi ([@alex-key](http://github.com/alex-key))
- Shohei Maeda

## v2.2.3

[compare changes](https://github.com/nitrojs/nitro/compare/v2.2.2...v2.2.3)


### 🚀 Enhancements

  - Add lagon preset ([#964](https://github.com/nitrojs/nitro/pull/964))

### 🩹 Fixes

  - **node-cluster:** Default number of workers ([#963](https://github.com/nitrojs/nitro/pull/963))
  - **cloudflare-pages:** Exclude assets from function call ([#965](https://github.com/nitrojs/nitro/pull/965))
  - **cloudflare-pages:** Handle assets only for get requests ([#968](https://github.com/nitrojs/nitro/pull/968))
  - Render json errors for cors requests ([#969](https://github.com/nitrojs/nitro/pull/969))
  - Use json response for  errors in `/api/` routes ([#971](https://github.com/nitrojs/nitro/pull/971))

### 💅 Refactors

  - **externals:** Sort `bundledDependencies` keys in output `package.json` ([#967](https://github.com/nitrojs/nitro/pull/967))

### 📖 Documentation

  - **cloudflare:** Add info regarding `runtimeConfig` and environment variables ([#958](https://github.com/nitrojs/nitro/pull/958))
  - Prevent ellipsis overflow on small screens ([#956](https://github.com/nitrojs/nitro/pull/956))
  - **deploy:** Add workers page for edge limitations ([#953](https://github.com/nitrojs/nitro/pull/953))

### 🏡 Chore

  - **cli:** Mention `prepare` command in usage ([#959](https://github.com/nitrojs/nitro/pull/959))
  - Update dependencies ([2658072](https://github.com/nitrojs/nitro/commit/2658072))

### ❤️  Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))
- Daniel Roe <daniel@roe.dev>
- Jan-Henrik Damaschke <jdamaschke@outlook.de>
- Bogdan Kostyuk <bogdankostyuk12@gmail.com>
- Hminghe ([@hminghe](http://github.com/hminghe))
- Alexander Lichter ([@manniL](http://github.com/manniL))

## v2.2.2

[compare changes](https://github.com/nitrojs/nitro/compare/v2.2.1...v2.2.2)


### 🩹 Fixes

  - Correct `access-control-allow-methods` cors header name ([#944](https://github.com/nitrojs/nitro/pull/944))
  - Allow overriding assets `maxAge` using route rules ([db6e6c2](https://github.com/nitrojs/nitro/commit/db6e6c2))
  - **rollup:** Use mlly as fallback resolver when externals disabled ([#948](https://github.com/nitrojs/nitro/pull/948))
  - Don't render json response if url contains `/api/` ([#951](https://github.com/nitrojs/nitro/pull/951))

### 🏡 Chore

  - Update unjs dependencies ([b852c23](https://github.com/nitrojs/nitro/commit/b852c23))
  - Update jiti dependency ([716dc1a](https://github.com/nitrojs/nitro/commit/716dc1a))
  - Updare unbuild ([044bb6a](https://github.com/nitrojs/nitro/commit/044bb6a))

### ✅ Tests

  - **vercel:** Move custom test to additional tests ([fb361f8](https://github.com/nitrojs/nitro/commit/fb361f8))

### ❤️  Contributors

- Pooya Parsa <pooya@pi0.io>
- Daniel Roe <daniel@roe.dev>

## v2.2.1

[compare changes](https://github.com/nitrojs/nitro/compare/v2.2.0...v2.2.1)


### 🩹 Fixes

  - **static:** Remove `cache-control` headers when asset is not found ([e3d57fc](https://github.com/nitrojs/nitro/commit/e3d57fc))
  - Avoid circular imports ([#936](https://github.com/nitrojs/nitro/pull/936))

### 🏡 Chore

  - Update changelog ([8dde296](https://github.com/nitrojs/nitro/commit/8dde296))

### ❤️  Contributors

- Pooya Parsa <pyapar@gmail.com>

## v2.2.0

[compare changes](https://github.com/nitrojs/nitro/compare/v2.1.2...v2.2.0)

### ⭐ What is new?

- Runtime proxy support using route rules ([learn more](https://github.com/nitrojs/nitro/pull/926))
- Nested fetch calls with incoming headers and context in event context ([learn more](https://github.com/nitrojs/nitro/pull/930))
- Binary and Raw storage operations support ([learn more](https://github.com/unjs/unstorage/pull/141))
- [Cloudflare] Exposed `event.context.cf` ([learn more](https://github.com/nitrojs/nitro/pull/927))
- Built-in session support ([learn more](https://github.com/unjs/h3/pull/315))

### 🚀 Enhancements

- Support runtime proxy using route rules ([#926](https://github.com/nitrojs/nitro/pull/926))
- **cloudflare:** `cacheControl` support for public assets with with `maxAge` ([#922](https://github.com/nitrojs/nitro/pull/922))
- **cloudflare:** Expose `event.context.cf` ([#927](https://github.com/nitrojs/nitro/pull/927))
- **firebase:** Use nodejs 18 as default runtime ([#925](https://github.com/nitrojs/nitro/pull/925))
- Support `event.fetch` and `event.$fetch` ([#930](https://github.com/nitrojs/nitro/pull/930))
- **vercel:** Auto-detect runtime version ([#879](https://github.com/nitrojs/nitro/pull/879))

### 🩹 Fixes

- Apply cached rules to overlapping wildcard patterns ([#906](https://github.com/nitrojs/nitro/pull/906))
- **cloudflare:** Use full mime db ([#933](https://github.com/nitrojs/nitro/pull/933))

### ❤️ Contributors

- Pooya Parsa <pooya@pi0.io>
- Shohei Maeda
- Luke Nelson <luke@nelson.zone>
- Oleg Khalin
- Daniel Roe <daniel@roe.dev>

## v2.1.2

[compare changes](https://github.com/nitrojs/nitro/compare/v2.1.1...v2.1.2)

### 🩹 Fixes

- **types:** Allow narrowing of the method option in `NitroFetchOptions` ([#883](https://github.com/nitrojs/nitro/pull/883))
- **vercel-edge:** Add temporary workaround for ‍`process.cwd‍` usage ([#898](https://github.com/nitrojs/nitro/pull/898))
- **dev:** Don't overwrite proxy headers if already set ([#896](https://github.com/nitrojs/nitro/pull/896))
- Provide fallback string values for undefined `runtimeConfig` ([#907](https://github.com/nitrojs/nitro/pull/907))
- **vercel:** Allow non-glob cache rules to apply to `/` ([#908](https://github.com/nitrojs/nitro/pull/908))
- **externals:** Use stable dependency tree ([#909](https://github.com/nitrojs/nitro/pull/909))
- **dev:** Mount `src` and `root` as read-only by default ([#920](https://github.com/nitrojs/nitro/pull/920))

### 📖 Documentation

- Fix heroku typo ([#900](https://github.com/nitrojs/nitro/pull/900))
- Fix stormkit images path ([#903](https://github.com/nitrojs/nitro/pull/903))
- Fix path for server assets ([#917](https://github.com/nitrojs/nitro/pull/917))

### 🏡 Chore

- Update dependencies ([dbb89a1](https://github.com/nitrojs/nitro/commit/dbb89a1))
- Update unenv ([91c32c9](https://github.com/nitrojs/nitro/commit/91c32c9))

### ✅ Tests

- Update fixture ([e7209cb](https://github.com/nitrojs/nitro/commit/e7209cb))
- Fix type test only ([e1e686f](https://github.com/nitrojs/nitro/commit/e1e686f))

### ❤️ Contributors

- Pooya Parsa <pooya@pi0.io>
- SerKo
- Daniel Roe <daniel@roe.dev>
- Renato Lacerda <renato.ac.lacerda@gmail.com>
- Chad Lew
- Mike Laumann Bellika
- Harlan Wilton <harlan@harlanzw.com>
- Dany Sluijk <me@dany.dev>

## v2.1.1

[compare changes](https://github.com/nitrojs/nitro/compare/v2.1.0...v2.1.1)

### 🩹 Fixes

- Resolve server assets dir relative to `srcDir` ([#893](https://github.com/nitrojs/nitro/pull/893))
- **prerender:** Encode urls passed to local fetch ([#891](https://github.com/nitrojs/nitro/pull/891))

### 🏡 Chore

- Update unenv ([b77f082](https://github.com/nitrojs/nitro/commit/b77f082))
- Format code ([50e1a8f](https://github.com/nitrojs/nitro/commit/50e1a8f))

### ❤️ Contributors

- Pooya Parsa <pooya@pi0.io>
- Manh-gntvn
- Daniel Roe <daniel@roe.dev>

## v2.1.0

[compare changes](https://github.com/nitrojs/nitro/compare/v2.0.0...v2.1.0)

### 🚀 Enhancements

- Add `shouldBypassCache` option to cache utils ([#874](https://github.com/nitrojs/nitro/pull/874))
- **cache:** Allow async `getKey` option ([#878](https://github.com/nitrojs/nitro/pull/878))

### 🩹 Fixes

- **scan:** Do not dedup middleware handlers ([#880](https://github.com/nitrojs/nitro/pull/880))
- **externals:** Use portable symlinks ([#882](https://github.com/nitrojs/nitro/pull/882))

### 📖 Documentation

- **deployment:** Heroku with nginx ([#873](https://github.com/nitrojs/nitro/pull/873))
- **netlify:** Clarify placement of `_redirects` file ([#870](https://github.com/nitrojs/nitro/pull/870))
- **digitalocean:** Update deployment guide ([#862](https://github.com/nitrojs/nitro/pull/862))

### 🏡 Chore

- Update dependencies ([963c587](https://github.com/nitrojs/nitro/commit/963c587))

### ❤️ Contributors

- Pooya Parsa <pooya@pi0.io>
- Daniel Roe <daniel@roe.dev>
- MiniDigger < Martin>
- Christopher Lis
- Ola Alsaker <ola.alsaker@gmail.com>
- Adeyemi Adetayo <adeyemiadetayo07@gmail.com>

## v2.0.0

[compare changes](https://github.com/nitrojs/nitro/compare/v2.0.0-rc.1...v2.0.0)

### 🩹 Fixes

- Add node16 compatible type declaration ([#868](https://github.com/nitrojs/nitro/pull/868))
- **externals:** Improve multi version handling ([#871](https://github.com/nitrojs/nitro/pull/871))

### ❤️ Contributors

- Pooya Parsa <pyapar@gmail.com>
- Daniel Roe <daniel@roe.dev>

## v2.0.0-rc.1

[compare changes](https://github.com/nitrojs/nitro/compare/v2.0.0-rc.0...v2.0.0-rc.1)

### 🚀 Enhancements

- **externals:** Apply `production` condition to package.exports ([#867](https://github.com/nitrojs/nitro/pull/867))
- Enable auto imports from `utils` dir ([#866](https://github.com/nitrojs/nitro/pull/866))

### 🩹 Fixes

- **prerender:** Update preview command to serve matching routes ([#864](https://github.com/nitrojs/nitro/pull/864))
- **externals:** Support orphan files in `node_modules` ([#865](https://github.com/nitrojs/nitro/pull/865))
- Avoid hiding original rollup error message ([a5586f8](https://github.com/nitrojs/nitro/commit/a5586f8))
- **cache:** Only update cache in storage once per pending request ([#861](https://github.com/nitrojs/nitro/pull/861))

### 🏡 Chore

- Lint with `eslint --cache` and improve types in `.eslintrc` ([#863](https://github.com/nitrojs/nitro/pull/863))
- Update dependencies ([c52d256](https://github.com/nitrojs/nitro/commit/c52d256))
- Remove random import ([246b726](https://github.com/nitrojs/nitro/commit/246b726))

### ❤️ Contributors

- Pooya Parsa <pooya@pi0.io>
- Yasser Lahbibi <yasser.lahbibi@apenhet.com>
- O-az <github@omaraziz.dev>
- Daniel Roe <daniel@roe.dev>

## v2.0.0-rc.0

[compare changes](https://github.com/nitrojs/nitro/compare/v1.0.0...v2.0.0-rc.0)

### 🚀 Enhancements

- ⚠️ Upgrade rollup to 3.x ([#580](https://github.com/nitrojs/nitro/pull/580))
- **types:** Correctly type $fetch based on the method ([#686](https://github.com/nitrojs/nitro/pull/686))
- **cli:** `prepare` command ([#774](https://github.com/nitrojs/nitro/pull/774))
- **cache:** Allow setting custom `getKey` for `defineCachedEventHandler` ([#744](https://github.com/nitrojs/nitro/pull/744))
- **dev:** Support for `/_vfs.json` ([#809](https://github.com/nitrojs/nitro/pull/809))
- **netlify:** Use esm entrypoint ([#833](https://github.com/nitrojs/nitro/pull/833))
- ⚠️ Rewrite external copy with multi version hoisting support ([#782](https://github.com/nitrojs/nitro/pull/782))
- Add `shouldInvalidateCache ` option to cache utils ([#746](https://github.com/nitrojs/nitro/pull/746))
- `edgio` preset (replacing `layer0`) ([#858](https://github.com/nitrojs/nitro/pull/858))
- Support `maxAge` for public assets ([#860](https://github.com/nitrojs/nitro/pull/860))
- Support `staleMaxAge: -1` to always respond stale value ([#857](https://github.com/nitrojs/nitro/pull/857))

### 🩹 Fixes

- GitHub template ([#712](https://github.com/nitrojs/nitro/pull/712))
- **deno:** Implement readAsset ([#694](https://github.com/nitrojs/nitro/pull/694))
- Normalize nitro plugin paths to url in development ([#732](https://github.com/nitrojs/nitro/pull/732))
- Use file urls for auto-imports in development ([#733](https://github.com/nitrojs/nitro/pull/733))
- Initialise imports.imports ([#737](https://github.com/nitrojs/nitro/pull/737))
- Allow optional `output` property in user rollup config ([#751](https://github.com/nitrojs/nitro/pull/751))
- Accept both upper/lower-case methods ([#752](https://github.com/nitrojs/nitro/pull/752))
- **prerender:** Check each segment length is less than 255 chars and whole path 1024 ([#757](https://github.com/nitrojs/nitro/pull/757))
- Include only compressible mime types ([#761](https://github.com/nitrojs/nitro/pull/761))
- Remove base url before calculating route rules ([#767](https://github.com/nitrojs/nitro/pull/767))
- **netlify, vercel:** Order route rules from most specific + avoid double-rendering root ([#768](https://github.com/nitrojs/nitro/pull/768))
- **build:** Correctly formatted fs tree ([#778](https://github.com/nitrojs/nitro/pull/778))
- **prerender:** Decode urls to allow comma in the `x-nitro-prerender` header ([#799](https://github.com/nitrojs/nitro/pull/799))
- **build:** Do not override publicAssets ([#817](https://github.com/nitrojs/nitro/pull/817))
- **dev:** Improve vfs ui ([#802](https://github.com/nitrojs/nitro/pull/802))
- Resolve and include scanDirs within `node_modules` for auto import ([#812](https://github.com/nitrojs/nitro/pull/812))
- **netlify, vercel:** Explicit server rendering with disabled cache/swr ([#829](https://github.com/nitrojs/nitro/pull/829))
- **prerender:** Check link's pathname only for extensions ([#791](https://github.com/nitrojs/nitro/pull/791))
- **runtime:** Disable server-timing header via options.timing ([#823](https://github.com/nitrojs/nitro/pull/823))
- Avoid using file urls for normalized paths in options ([7517293](https://github.com/nitrojs/nitro/commit/7517293))
- Rollup treeshake is dump ([2ce4edb](https://github.com/nitrojs/nitro/commit/2ce4edb))
- **externals:** Normalize `inline` and `external` windows paths ([0638f64](https://github.com/nitrojs/nitro/commit/0638f64))
- **netlify, aws:** Omit cookies from v1 response ([#834](https://github.com/nitrojs/nitro/pull/834))
- Filter unique scanned handlers ([#807](https://github.com/nitrojs/nitro/pull/807))
- **nitro:** Resolve server asset dirs relative to `srcDir` ([#825](https://github.com/nitrojs/nitro/pull/825))
- **public-assets:** Mock readAsset promise properly ([#851](https://github.com/nitrojs/nitro/pull/851))
- **externals:** Avoid recursive package links ([b77735e](https://github.com/nitrojs/nitro/commit/b77735e))

### 💅 Refactors

- Upgrade and reduce usage of `fs-extra` ([cfbd029](https://github.com/nitrojs/nitro/commit/cfbd029))
- Update `event.` to `event.node.` ([#828](https://github.com/nitrojs/nitro/pull/828))

### 📖 Documentation

- Fix url in auto-imports guide ([#683](https://github.com/nitrojs/nitro/pull/683))
- Fix spelling of cluster ([#720](https://github.com/nitrojs/nitro/pull/720))
- Wording change ([#724](https://github.com/nitrojs/nitro/pull/724))
- Fix readme grammar ([#813](https://github.com/nitrojs/nitro/pull/813))
- Fix deprecated function in routing example ([#816](https://github.com/nitrojs/nitro/pull/816))
- Add new render deployment example & steps ([#811](https://github.com/nitrojs/nitro/pull/811))
- Fix typo in code block ([#830](https://github.com/nitrojs/nitro/pull/830))
- Add cache base option example & description ([#781](https://github.com/nitrojs/nitro/pull/781))

### 🏡 Chore

- Lint repository with eslint config and format with prettier ([#739](https://github.com/nitrojs/nitro/pull/739))
- Limit prettier lint to src ([6a735b1](https://github.com/nitrojs/nitro/commit/6a735b1))
- Fix type issue ([a60e4bd](https://github.com/nitrojs/nitro/commit/a60e4bd))
- Fix lint issues ([7ee8e7f](https://github.com/nitrojs/nitro/commit/7ee8e7f))
- Disable failing api type tests ([1d9102a](https://github.com/nitrojs/nitro/commit/1d9102a))
- Fix lint issue ([30e4d32](https://github.com/nitrojs/nitro/commit/30e4d32))
- Add missing parenthesis in header ([#801](https://github.com/nitrojs/nitro/pull/801))
- Add lint fix command shortcut ([#835](https://github.com/nitrojs/nitro/pull/835))
- Update lockfile ([bb9ac5b](https://github.com/nitrojs/nitro/commit/bb9ac5b))

### ✅ Tests

- Add tests for dev server and proxy ([#644](https://github.com/nitrojs/nitro/pull/644))
- Re-enable api type tests and fix type assertion ([#772](https://github.com/nitrojs/nitro/pull/772))
- Update fixtures ([a52c832](https://github.com/nitrojs/nitro/commit/a52c832))

### 🎨 Styles

- Lint code ([15edef0](https://github.com/nitrojs/nitro/commit/15edef0))

### 🤖 CI

- Run tests against windows as well ([#837](https://github.com/nitrojs/nitro/pull/837))

#### ⚠️ Breaking Changes

- ⚠️ Upgrade rollup to 3.x ([#580](https://github.com/nitrojs/nitro/pull/580))
- ⚠️ Rewrite external copy with multi version hoisting support ([#782](https://github.com/nitrojs/nitro/pull/782))

### ❤️ Contributors

- Pooya Parsa <pooya@pi0.io>
- Yasser Lahbibi <yasser.lahbibi@apenhet.com>
- Harlan Wilton <harlan@harlanzw.com>
- Christian Preston <christianpreston@ymail.com>
- Louis Haftmann
- Daniel Roe <daniel@roe.dev>
- Xin Du (Clark) <clark.duxin@gmail.com>
- Jonas Thelemann <e-mail@jonas-thelemann.de>
- Shoubhit Dash <shoubhit2005@gmail.com>
- Anthony Fu <anthonyfu117@hotmail.com>
- Chambers
- Patrick Schnyder
- Alvar Lagerlöf
- Pascal
- Eduardo San Martin Morote
- Johann Schopplich <mail@johannschopplich.com>
- Nathan Chase <nathan@nathanchase.com>
- Dany Sluijk <me@dany.dev>
- Alexander Lichter <github@lichter.io>
- Nobody5050
- Ʀᴀʏ <nn_201312@163.com>
- Nozomu Ikuta
- James Ray <james.a.ray@jpl.nasa.gov>
- SerKo

## [1.0.0](https://github.com/nitrojs/nitro/compare/v1.0.0-1...v1.0.0) (2022-11-16)

## [1.0.0-1](https://github.com/nitrojs/nitro/compare/v1.0.0-0...v1.0.0-1) (2022-11-16)

### Features

- **vercel:** incremental static generation + swr ([#545](https://github.com/nitrojs/nitro/issues/545)) ([88ce2de](https://github.com/nitrojs/nitro/commit/88ce2de96ef5bab1e945e539e61581cd33aaf54b))

### Bug Fixes

- upgrade hookable to 5.x ([dc3383b](https://github.com/nitrojs/nitro/commit/dc3383b4c74f2411600af271ccc30753a727e1fb))

## [1.0.0-0](https://github.com/nitrojs/nitro/compare/v0.6.2...v1.0.0-0) (2022-11-15)

### ⚠ BREAKING CHANGES

- remove deprecated `autoImport`

- remove deprecated `autoImport` ([c99fa44](https://github.com/nitrojs/nitro/commit/c99fa441eeb1992af087a6bec85ea868a5eb1e62))

### [0.6.2](https://github.com/nitrojs/nitro/compare/v0.6.1...v0.6.2) (2022-11-15)

### Bug Fixes

- **cloudflare:** pass raw body instead of parsing it ([#629](https://github.com/nitrojs/nitro/issues/629)) ([837f894](https://github.com/nitrojs/nitro/commit/837f894c310ad27854cfa0dc538c6c033e2a3d41))

## 0.4.24

### 🚀 Enhancements

- Add cloudflare-pages preset (#210)
- Support prerendering binary files (#320)
- Opt-in option to compress public assets using `gzip` and `br` (#449)
- Allow specifying wasm plugin options (#450)
- Allow using `extends` alongside with `preset` (6a43985)

### 🩹 Fixes

- **azure:** Fix route name (#430)
- Update types for defu usage (0f241bc)
- Add resolved side-effect for node-fetch-native (#435)
- **aws-lambda:** Join cookies with semicolon (#356)
- **aws-lambda:** Fix normalizeIncomingHeaders (#418)
- **aws-lambda:** Return outgoing cookies on response objects (#357)
- **aws-lambda:** Add `multiValueQueryStringParameters` to aws preset (#398)
- ⚠️ Update unenv to 0.6.x (#438)
- Add code location and codeframe for rollup errors (#406)
- **prerender:** Allow updating route contents (#452)
- **externals:** ⚠️ Fall back to `mlly` resolver in more cases (#431)
- ⚠️ `NITRO_PRESET` should have highest periority (92d711f)

### 💅 Refactors

- ⚠️ Rename options `autoImport` to `imports` (#433)
- Utilize knitwork to generate safe variable names (#447)

### 📖 Documentation

- Migrate to docus (#365)
- Simplify deploy index route (a1d7b17)
- **storage:** Fix typo (#424)

### 🏡 Chore

- Update lock (4ceeee2)
- Narrow plugin override type (b4e24f6)
- Add `@vitest/coverage-c8` (4a5e565)
- Remove unused `@types/jsdom` from dependencies (#429)
- Add vitest config (ab59150)

### 📦 Build

- Expose `package.json` subpath export (d0029c0)
- Use changelogen to bump edge and generate chagelog (679e356)

#### ⚠️ Breaking Changes

- ⚠️ Update unenv to 0.6.x (#438)
- **externals:** ⚠️ Fall back to `mlly` resolver in more cases (#431)
- ⚠️ `NITRO_PRESET` should have highest periority (92d711f)
- ⚠️ Rename options `autoImport` to `imports` (#433)

### ❤️ Contributors

- Ahad Birang
- Alexander Lichter
- Anthony Fu
- Daniel Roe
- Dániel Földi
- Eckhardt (Kaizen) Dreyer
- Julien Huang
- Pooya Parsa
- Sören Schwert
- Tobias Diez
- Yaël Guilloux

### [0.4.24](https://github.com/nitrojs/nitro/compare/v0.4.23...v0.4.24) (2022-08-12)

### Bug Fixes

- **renderer:** do not use default error fallback ([80081b0](https://github.com/nitrojs/nitro/commit/80081b0b70d845c29ec24d98573c2179590fafc8))

### [0.4.23](https://github.com/nitrojs/nitro/compare/v0.4.22...v0.4.23) (2022-08-12)

### Bug Fixes

- **renderer:** handle unhandled errors ([319b277](https://github.com/nitrojs/nitro/commit/319b27789d5c5a7bb154bd264408dc0689104732))

### [0.4.22](https://github.com/nitrojs/nitro/compare/v0.4.21...v0.4.22) (2022-08-11)

### Bug Fixes

- fix dist dir check regex ([6cad682](https://github.com/nitrojs/nitro/commit/6cad6821039328e099b4b1a6cba5f73eba42a111))

### [0.4.21](https://github.com/nitrojs/nitro/compare/v0.4.20...v0.4.21) (2022-08-11)

### Bug Fixes

- properly resolve dist dir ([d7c65e6](https://github.com/nitrojs/nitro/commit/d7c65e6c4c2257e044c8c6e0f46b0b1739af1a4d))

### [0.4.20](https://github.com/nitrojs/nitro/compare/v0.4.19...v0.4.20) (2022-08-11)

### [0.4.19](https://github.com/nitrojs/nitro/compare/v0.4.18...v0.4.19) (2022-08-11)

### Bug Fixes

- only log unhandled and fatal errors ([#407](https://github.com/nitrojs/nitro/issues/407)) ([2d5b039](https://github.com/nitrojs/nitro/commit/2d5b039499f30ed9fbef19495503f95225a59159))

### [0.4.18](https://github.com/nitrojs/nitro/compare/v0.4.17...v0.4.18) (2022-08-09)

### Bug Fixes

- **netlify:** update rollup output file ([8965bd5](https://github.com/nitrojs/nitro/commit/8965bd5b72c2599e20e1592175ef154449613358))

### [0.4.17](https://github.com/nitrojs/nitro/compare/v0.4.16...v0.4.17) (2022-08-09)

### Features

- **netlify:** emit `server.js` to leverage native esm ([#401](https://github.com/nitrojs/nitro/issues/401)) ([8304ae2](https://github.com/nitrojs/nitro/commit/8304ae24b5397c1a9dd64d1a5eb25d62069da900))

### [0.4.16](https://github.com/nitrojs/nitro/compare/v0.4.15...v0.4.16) (2022-08-09)

### Bug Fixes

- **prerender:** prerender `x-nitro` links without crawlLinks option ([46b445f](https://github.com/nitrojs/nitro/commit/46b445f8b21409540a66973be8fb693cce7812dc))

### [0.4.15](https://github.com/nitrojs/nitro/compare/v0.4.14...v0.4.15) (2022-08-09)

### Features

- **prerender:** basic ignore support ([a6cbbbe](https://github.com/nitrojs/nitro/commit/a6cbbbe482243a3d8dc4c3917ec406b74fdb2a8f))

### Bug Fixes

- **prerender:** apply extension filter only to parsed links ([541b0b0](https://github.com/nitrojs/nitro/commit/541b0b0662017ee8d1f5448a985d27c70a9e6303))
- set `x-nitro-prerender` header as lower-case ([9cee698](https://github.com/nitrojs/nitro/commit/9cee698c4c12b10cd588efc3234b69acdedb252d))

### [0.4.14](https://github.com/nitrojs/nitro/compare/v0.4.13...v0.4.14) (2022-08-08)

### Features

- call `render:response` hook for `defineRenderHandler` ([8238f38](https://github.com/nitrojs/nitro/commit/8238f3801aa959f8707c48e2d5777b54a6a7f74d))

### Bug Fixes

- expose `RenderResponse` and `RenderHandler` types ([e0ec2b2](https://github.com/nitrojs/nitro/commit/e0ec2b21c706e3882e57f70f0054c84a0e18186a))

### [0.4.13](https://github.com/nitrojs/nitro/compare/v0.4.12...v0.4.13) (2022-08-08)

### Features

- `defineRenderHandler` ([#395](https://github.com/nitrojs/nitro/issues/395)) ([758b046](https://github.com/nitrojs/nitro/commit/758b0463f19764ea799502795b52d6a547b37f81))
- add h3 auto imports preset ([#397](https://github.com/nitrojs/nitro/issues/397)) ([fbadeb7](https://github.com/nitrojs/nitro/commit/fbadeb77b867869a6a9268115531fe4d06cb677f))
- auto scan plugins ([0d1cd4d](https://github.com/nitrojs/nitro/commit/0d1cd4d7638797c7c5ec7fc21c28eca0f81edf01))
- enable response type infer for API routes with params ([#222](https://github.com/nitrojs/nitro/issues/222)) ([082d58f](https://github.com/nitrojs/nitro/commit/082d58fd6dc736047d69d41510d63111c7b16cc6))

### Bug Fixes

- **cache:** generate hashed path keys ([6104c54](https://github.com/nitrojs/nitro/commit/6104c54b946b616d475f970d02b7605fd69211a9))
- **config:** enable dotenv in development ([#347](https://github.com/nitrojs/nitro/issues/347)) ([ec086c6](https://github.com/nitrojs/nitro/commit/ec086c6a33f84ace17d2a40b8703d3e1ca97d7ae))
- include dotfiles in public assets ([#361](https://github.com/nitrojs/nitro/issues/361)) ([8a744fb](https://github.com/nitrojs/nitro/commit/8a744fbb38bc9b3c6a01d6bbce08c4aa64e7734a))
- **options:** add default aliases and resolve plugins ([f04560b](https://github.com/nitrojs/nitro/commit/f04560b6b92317a45ed384f61b5c74e9aa1f825d))
- **options:** exclude `buildDir` for auto-imports ([#355](https://github.com/nitrojs/nitro/issues/355)) ([5219c53](https://github.com/nitrojs/nitro/commit/5219c53d5c5dd1aacc5a9647831a5131a85078d5))
- **prerender:** remove `baseURL` from generated file paths ([#329](https://github.com/nitrojs/nitro/issues/329)) ([26c15ca](https://github.com/nitrojs/nitro/commit/26c15ca02e332643e06949fa4f1dbf7bee8a479d))
- **server-assets:** escape asset file names ([7aaab6d](https://github.com/nitrojs/nitro/commit/7aaab6d0262ceb6cd8487fc046eb4f866394cfe9))
- sort aliases to ensure priority is given to more specific aliases ([#388](https://github.com/nitrojs/nitro/issues/388)) ([2a36b1e](https://github.com/nitrojs/nitro/commit/2a36b1e7390681092d10f0d2c308f7e651fa4e9a))
- update scule to handle runtime config with numbers ([64b740e](https://github.com/nitrojs/nitro/commit/64b740eea43be93ed5c56da30cd0eaf28305c352)), closes [nuxt/framework#6172](https://github.com/nuxt/framework/issues/6172)
- update unstorage to prevent path traverse ([d5d802f](https://github.com/nitrojs/nitro/commit/d5d802f3e18257b4dab4c2f8bcc27d455543fe22))
- **worker:** preserve esmodule symbol for dynamic imports ([#354](https://github.com/nitrojs/nitro/issues/354)) ([0cd5121](https://github.com/nitrojs/nitro/commit/0cd51217d857b8f7090989d92fe3f1d99f41b0f6))

### [0.4.12](https://github.com/nitrojs/nitro/compare/v0.4.11...v0.4.12) (2022-07-13)

### Bug Fixes

- **vercel, vercel-edge:** set version as number ([f476cfc](https://github.com/nitrojs/nitro/commit/f476cfc3e33d0b759e604ff6c0c61ea272e1379a))

### [0.4.11](https://github.com/nitrojs/nitro/compare/v0.4.10...v0.4.11) (2022-07-13)

### Bug Fixes

- **vercel-edge:** properly set rollup options ([ad5b735](https://github.com/nitrojs/nitro/commit/ad5b7355d0a4463c0bebd1386ebf2049360bc3e1))

### [0.4.10](https://github.com/nitrojs/nitro/compare/v0.4.9...v0.4.10) (2022-07-13)

### Features

- `vercel-edge` provider ([#337](https://github.com/nitrojs/nitro/issues/337)) ([ad2b976](https://github.com/nitrojs/nitro/commit/ad2b976536c80a423b48facda455efce6b0be365))
- **rollup:** support `development` and `production` export conditions ([f60e6eb](https://github.com/nitrojs/nitro/commit/f60e6eba50e4db4dc48c5d4f860d61f1cc55613b))
- **vercel:** update to the v3 output api ([#336](https://github.com/nitrojs/nitro/issues/336)) ([9ac4be2](https://github.com/nitrojs/nitro/commit/9ac4be267d380851c469a299c9834e9200836d3a))

### Bug Fixes

- call `rollup:before` before generating rollup config ([#335](https://github.com/nitrojs/nitro/issues/335)) ([292b495](https://github.com/nitrojs/nitro/commit/292b495e8c1eb620202cd3f1639c59f0a3ce203f))
- **vercel-edge:** use esm default export ([7d251f5](https://github.com/nitrojs/nitro/commit/7d251f5ff0041cccc308ae7f144dcf2a0017559b))
- **vercel:** add back filesystem route handlers ([bba4064](https://github.com/nitrojs/nitro/commit/bba4064356bf8340ed8e9eaca0d7deadbcc904fb))
- **vercel:** update output config ([daecb91](https://github.com/nitrojs/nitro/commit/daecb91ae27e8f77ea0aa7e61a6dc383707a0c49)), closes [#336](https://github.com/nitrojs/nitro/issues/336)

### [0.4.9](https://github.com/nitrojs/nitro/compare/v0.4.8...v0.4.9) (2022-06-29)

### Features

- expose router in NitroApp ([#302](https://github.com/nitrojs/nitro/issues/302)) ([ef5e7f1](https://github.com/nitrojs/nitro/commit/ef5e7f19cd9d332b4fdb97477d05f6d319b6d2c5))
- **service-worker:** inject registration script to all pages ([#299](https://github.com/nitrojs/nitro/issues/299)) ([486f236](https://github.com/nitrojs/nitro/commit/486f236c1e96134c0ee8021ff5d04e93fe819e75))

### Bug Fixes

- get storage mounts type from unstorage ([134f89f](https://github.com/nitrojs/nitro/commit/134f89f5d0c3045e3435b27c56f89171379c4c81))
- **azure:** pass query params to local call ([#318](https://github.com/nitrojs/nitro/issues/318)) ([f1fe6cd](https://github.com/nitrojs/nitro/commit/f1fe6cd9ad9621546eb66a9b8484d1870ae86110))
- export runtime types directly from `nitropack` ([#301](https://github.com/nitrojs/nitro/issues/301)) ([34b8c4d](https://github.com/nitrojs/nitro/commit/34b8c4d921b2c6dc708ad6c11cb765935b66b3c0))
- **isPublicAssetURL:** assets should treat as public ([#312](https://github.com/nitrojs/nitro/issues/312)) ([e165b3b](https://github.com/nitrojs/nitro/commit/e165b3bdabf8a0082387060df89a1726a3056e0a))
- **prerender:** avoid adding duplicate `baseURL` for local fetch ([#289](https://github.com/nitrojs/nitro/issues/289)) ([cbc7ba3](https://github.com/nitrojs/nitro/commit/cbc7ba3835df539116ca6560a85365615af55fbb))
- **types:** allow `autoImport` option to be false ([#296](https://github.com/nitrojs/nitro/issues/296)) ([3aa3bcf](https://github.com/nitrojs/nitro/commit/3aa3bcfef4b98528db6b31d620177a57a69afdf4))

### [0.4.8](https://github.com/nitrojs/nitropack/compare/v0.4.7...v0.4.8) (2022-06-15)

### Bug Fixes

- disable auto import include for scanDirs ([4c057cd](https://github.com/nitrojs/nitropack/commit/4c057cdd939485c4f416f33d776dadaeb498ed3e)), closes [#277](https://github.com/nitrojs/nitropack/issues/277)

### [0.4.7](https://github.com/nitrojs/nitropack/compare/v0.4.6...v0.4.7) (2022-06-14)

### Bug Fixes

- check if socket address/port/family are set ([#287](https://github.com/nitrojs/nitropack/issues/287)) ([8fb3ad9](https://github.com/nitrojs/nitropack/commit/8fb3ad93b9c2d0da9a95183818cf228c1b16b99b))
- don't use file url when building prerenderer ([#286](https://github.com/nitrojs/nitropack/issues/286)) ([2e7c548](https://github.com/nitrojs/nitropack/commit/2e7c5482c736d8c749d9151bc2f588ebb69a4a83))

### [0.4.6](https://github.com/nitrojs/nitropack/compare/v0.4.5...v0.4.6) (2022-06-13)

### Features

- update unstorage to 0.5.x ([c5cabbf](https://github.com/nitrojs/nitropack/commit/c5cabbf6453fe7da46f52a899d2c79fdb56d5b2c))

### [0.4.5](https://github.com/nitrojs/nitropack/compare/v0.4.4...v0.4.5) (2022-06-12)

### Features

- **dev:** add `x-forwarded` headers ([#247](https://github.com/nitrojs/nitropack/issues/247)) ([2d50312](https://github.com/nitrojs/nitropack/commit/2d50312c6f84f4a5ea152556ecd143a0944f9fc1))

### Bug Fixes

- add `scanDirs` to auto-import include ([#277](https://github.com/nitrojs/nitropack/issues/277)) ([3f8a08e](https://github.com/nitrojs/nitropack/commit/3f8a08ec6e8421c7311fad8c306fe28586ee83f8))
- append .cache to the key of cached routes/functions ([#249](https://github.com/nitrojs/nitropack/issues/249)) ([1d4328c](https://github.com/nitrojs/nitropack/commit/1d4328cceb4245ef01ce789ba6b85a7d4956e22c))
- avoid empty scanned route (resolves [#283](https://github.com/nitrojs/nitropack/issues/283)) ([a087673](https://github.com/nitrojs/nitropack/commit/a0876732acadfda2e2c2699a947ea08e6af28d0d))
- **cache:** expose all cache aliases and types ([361d12f](https://github.com/nitrojs/nitropack/commit/361d12f61a102caac7c9c32ab25d3e662cec80a9))
- **cache:** invalidate entry before calling resolver ([#271](https://github.com/nitrojs/nitropack/issues/271)) ([7358d5b](https://github.com/nitrojs/nitropack/commit/7358d5bdc8131f98d1d29aff23dceb4bb702b879))
- **cache:** normalize path keys for `defineCachedEventHandler` ([97625ec](https://github.com/nitrojs/nitropack/commit/97625ec7fc4d44529fe7e2be16bbeaa3e4f38b98))
- **cloudflare:** use `@cloudflare/wrangler` until we support wrangler 2 ([#265](https://github.com/nitrojs/nitropack/issues/265)) ([d7fa6ce](https://github.com/nitrojs/nitropack/commit/d7fa6ce00a97f0573c5524fb0ee4080b2aa58542))
- exclude internal `/_*`, `/api/_*` routes from NitroFetchRequest type ([#232](https://github.com/nitrojs/nitropack/issues/232)) ([00aa131](https://github.com/nitrojs/nitropack/commit/00aa13161f3c8da451614925daf4cd897a838aa3))
- **stormkit:** update request signature ([#264](https://github.com/nitrojs/nitropack/issues/264)) ([78bf46a](https://github.com/nitrojs/nitropack/commit/78bf46a324b304516574c538b9b59f50b1f21ed0))

### [0.4.4](https://github.com/nitrojs/nitropack/compare/v0.4.3...v0.4.4) (2022-05-11)

### Bug Fixes

- update `NitroFetchRequest` type to support `string` type ([#226](https://github.com/nitrojs/nitropack/issues/226)) ([3542b61](https://github.com/nitrojs/nitropack/commit/3542b6148a4068e4c2dc74c617fa6e225739bf12))
- update unenv and add `node-fetch-native/polyfill` to `moduleSideEffects` ([e70a9f0](https://github.com/nitrojs/nitropack/commit/e70a9f0b4333ab4804a4afc31e7c666e4ca77e59))

### [0.4.3](https://github.com/nitrojs/nitropack/compare/v0.4.2...v0.4.3) (2022-05-10)

### Features

- add `NitroFetchRequest` type and enhance $fetch's request type ([#209](https://github.com/nitrojs/nitropack/issues/209)) ([57b9ed0](https://github.com/nitrojs/nitropack/commit/57b9ed0bc4ef15dc36a58ae60810feaedd367c15))
- add `prerender:route` hook ([#213](https://github.com/nitrojs/nitropack/issues/213)) ([9c9fb34](https://github.com/nitrojs/nitropack/commit/9c9fb3401246e534374588c681cb77871b0efaaa))
- **prerender:** add preview command ([#217](https://github.com/nitrojs/nitropack/issues/217)) ([08614c5](https://github.com/nitrojs/nitropack/commit/08614c50f0365c6d68cf2b18841ac13a3c62cdaa))
- show stack-trace of unhandled errors with `DEBUG` env ([#212](https://github.com/nitrojs/nitropack/issues/212)) ([b366f3f](https://github.com/nitrojs/nitropack/commit/b366f3fae0605af75b2eb86839c5a94804a52ffb))

### Bug Fixes

- add missing include path `../../**/*` in generated tsconfig.json ([#205](https://github.com/nitrojs/nitropack/issues/205)) ([8978404](https://github.com/nitrojs/nitropack/commit/89784044de3c5d7b518225488684f0b391a372be))
- respect baseURL in prerendering ([#219](https://github.com/nitrojs/nitropack/issues/219)) ([3e8eddb](https://github.com/nitrojs/nitropack/commit/3e8eddb20a609c1405d1e531dba2fba3a39384db))
- set built-in storage mounts before nitro init ([d1c6c64](https://github.com/nitrojs/nitropack/commit/d1c6c64384afdee7424eebc51a4c42978f4dc1c5))

### [0.4.2](https://github.com/nitrojs/nitropack/compare/v0.4.1...v0.4.2) (2022-05-07)

### Bug Fixes

- **node, preereender:** add handler for `unhandledRejection` ([3319912](https://github.com/nitrojs/nitropack/commit/3319912635320a8da1022045042b2c041fa6f6c2))
- **prerender:** only crawl known extensions (non or `.json`) ([2dbc8b9](https://github.com/nitrojs/nitropack/commit/2dbc8b9b0d9122a797009e31b1303b3fc625d0ac))

### [0.4.1](https://github.com/nitrojs/nitropack/compare/v0.4.0...v0.4.1) (2022-05-06)

### Bug Fixes

- support fallback for `import.meta` per chunk ([5a83ec6](https://github.com/nitrojs/nitropack/commit/5a83ec62c4db52b11c88a18baa5c16bca3f71b4f))
- use distinct prefix for lazy handler imports ([0cc7be1](https://github.com/nitrojs/nitropack/commit/0cc7be13a1ec125d888bc40f00be280bdc81c8fe))

## [0.4.0](https://github.com/nitrojs/nitropack/compare/v0.3.12...v0.4.0) (2022-05-05)

### ⚠ BREAKING CHANGES

- **cache:** only accept event handler for `defineCachedEventHandler`
- **prerender:** write html files to subfolder (resolves #166)

### Features

- `nitro.storage` ([e1c234e](https://github.com/nitrojs/nitropack/commit/e1c234eaa59db02bbc76d5b0272b153bb2a238ae))
- add `X-Nitro-Prerender` header to detect prerendering ([11e732b](https://github.com/nitrojs/nitropack/commit/11e732b6d3c53ca2d8b7e09be9f0da4550eb5d0c))
- allow explicit middleware handlers ([23d8cde](https://github.com/nitrojs/nitropack/commit/23d8cde6942c051872aa4286b49ee7ee88ee9254))
- **cache:** only accept event handler for `defineCachedEventHandler` ([7e72b8f](https://github.com/nitrojs/nitropack/commit/7e72b8f327fb0141bce32d2b0b50e357ec6a7a07))
- expose all assets to `nitro.vfs` and `/_vfs` endpoint (resolves [#173](https://github.com/nitrojs/nitropack/issues/173)) ([9bf2d71](https://github.com/nitrojs/nitropack/commit/9bf2d710583d5b6297a1afed1c3d33b8c8826e50))
- extend prerender links from `X-Nitro-Prerender` (resolves [#115](https://github.com/nitrojs/nitropack/issues/115)) ([9423524](https://github.com/nitrojs/nitropack/commit/94235246d155c13f886a26a24162d6fd6e9c67d5))
- named wildcard params ([233e024](https://github.com/nitrojs/nitropack/commit/233e024c75940c26c9113b374bbd7e35a8e0a31f))
- **prerender:** write html files to subfolder (resolves [#166](https://github.com/nitrojs/nitropack/issues/166)) ([cdcd35a](https://github.com/nitrojs/nitropack/commit/cdcd35adf3e4f1d3902605f97559c0dcf6d0febf))
- **rollup:** allow edit of commonJs plugin options ([#187](https://github.com/nitrojs/nitropack/issues/187)) ([c7759e9](https://github.com/nitrojs/nitropack/commit/c7759e90a67987ef20e5fadacc354f9934ef9cc3))
- **rollup:** fail build when externals are not allowed and cannot resolve id ([ff2dd44](https://github.com/nitrojs/nitropack/commit/ff2dd443641ad2b72b1e22c2075a20099222e2c6))
- universal `import.meta` (resolves [#181](https://github.com/nitrojs/nitropack/issues/181)) ([929322b](https://github.com/nitrojs/nitropack/commit/929322b5c6e3afd9f631613f07dcdd4e81a88dab))
- update unenv ([04e2f26](https://github.com/nitrojs/nitropack/commit/04e2f2605b899e20a151efb62a6f81ccf1cfbc4e))

### Bug Fixes

- **cache:** preserve event context (resolves [#189](https://github.com/nitrojs/nitropack/issues/189)) ([6cdbc4a](https://github.com/nitrojs/nitropack/commit/6cdbc4ac72dbec999d19eb3750ce392a462610a6))
- enable lazy only when explicitly set (enable for api and rotues by default) ([247cfca](https://github.com/nitrojs/nitropack/commit/247cfca88e2f9aea529d23fc42af4e833f7c7cc2))
- **handlers:** respect default value for lazy ([89da30a](https://github.com/nitrojs/nitropack/commit/89da30a7740398fe5531f223f15357dcc9ddb807))
- improve bundled storage ([#179](https://github.com/nitrojs/nitropack/issues/179)) ([d4cb863](https://github.com/nitrojs/nitropack/commit/d4cb863c46047564d170bb183444e5bcdcb619c9))
- **prerender:** allow all extensions (resolves [#190](https://github.com/nitrojs/nitropack/issues/190)) ([4b15520](https://github.com/nitrojs/nitropack/commit/4b15520f18f62108e9260fbc9a2881f838710fda))
- **prerender:** support relative urls ([970286d](https://github.com/nitrojs/nitropack/commit/970286dacfcf8336f9c4d46c3f774d32bd0dfbca))
- **rollup:** enable `preferBuiltins` only for node targets ([32f598a](https://github.com/nitrojs/nitropack/commit/32f598afaec65014e499980baa18cd7bb331b6ce))
- **rollup:** respect `rollupConfig` options to override default config ([43b1d02](https://github.com/nitrojs/nitropack/commit/43b1d023117060a216c290888c71297c3b3376f3))
- **rollup:** set `NODE_ENV` to `prerender` when prerendering ([2b7209a](https://github.com/nitrojs/nitropack/commit/2b7209aab8667d0470949b636ff383d85057a08d))
- **worker:** use `iife` format by default ([6c8cae7](https://github.com/nitrojs/nitropack/commit/6c8cae7e25c4a24e5d85e8e322248e2beebedef3))

### [0.3.12](https://github.com/nitrojs/nitropack/compare/v0.3.11...v0.3.12) (2022-05-02)

### Bug Fixes

- add missing `prefixStorage` import for bundled storage ([defa4de](https://github.com/nitrojs/nitropack/commit/defa4defeae038a01464821969986240b9288088))
- **storage:** skip bundled storage for dev and prerender ([31a3957](https://github.com/nitrojs/nitropack/commit/31a3957757614c4db61c271ecdb7c9c8f4e22d4a))

### [0.3.11](https://github.com/nitrojs/nitropack/compare/v0.3.10...v0.3.11) (2022-05-02)

### Bug Fixes

- **storage:** remove unused `prefixStorage` import ([7376c6d](https://github.com/nitrojs/nitropack/commit/7376c6dbc31cf277828160c7e22b4213fe142780))
- **storage:** use `devStorage` for dev and prerender ([93c4d85](https://github.com/nitrojs/nitropack/commit/93c4d851fd08b6b2fe9952f1ea833ed36899273a))

### [0.3.10](https://github.com/nitrojs/nitropack/compare/v0.3.9...v0.3.10) (2022-05-02)

### Features

- experimental bundled storage ([#160](https://github.com/nitrojs/nitropack/issues/160)) ([308e7c7](https://github.com/nitrojs/nitropack/commit/308e7c7d869345565747f9d986a6e77e9789cc1d))

### Bug Fixes

- **deps:** pin `@rollup/plugin-node-resolve` due to cloudflare issue ([3ecb813](https://github.com/nitrojs/nitropack/commit/3ecb813e72007ad4a8bb14f1b0892cee9761c66f))

### [0.3.9](https://github.com/nitrojs/nitropack/compare/v0.3.8...v0.3.9) (2022-05-02)

### Bug Fixes

- add cached shortcuts to the imports ([#162](https://github.com/nitrojs/nitropack/issues/162)) ([bf6d208](https://github.com/nitrojs/nitropack/commit/bf6d208866946b4251f7b5922128c03e6117bacd))
- **cloudflare:** normalize incoming & outgoing headers ([#171](https://github.com/nitrojs/nitropack/issues/171)) ([abda66b](https://github.com/nitrojs/nitropack/commit/abda66b65bca708aee731cc4b9f1ba493fc356f2))

### [0.3.8](https://github.com/nitrojs/nitropack/compare/v0.3.7...v0.3.8) (2022-04-27)

### Features

- improve raw asset handling ([#158](https://github.com/nitrojs/nitropack/issues/158)) ([a68d3d2](https://github.com/nitrojs/nitropack/commit/a68d3d25da90c1a131ff4de85b9d3160067baa90))

### Bug Fixes

- **cache:** replace magage typo by maxage ([#150](https://github.com/nitrojs/nitropack/issues/150)) ([07d8ced](https://github.com/nitrojs/nitropack/commit/07d8cedbf9d9d2105929f753d12e76254b31b204))
- replace `global.` in fewer instances ([#155](https://github.com/nitrojs/nitropack/issues/155)) ([73db5c9](https://github.com/nitrojs/nitropack/commit/73db5c9e0de1baffec93a47bee85c88a33c8d609))
- support patch method auto-scanning ([#153](https://github.com/nitrojs/nitropack/issues/153)) ([01801c2](https://github.com/nitrojs/nitropack/commit/01801c2e7a17effce8ff84d2cc6c5a488cce61a6))

### [0.3.7](https://github.com/nitrojs/nitropack/compare/v0.3.6...v0.3.7) (2022-04-25)

### Bug Fixes

- **rollup:** prepend `node_modules` to `moduleDirectories` ([458ff57](https://github.com/nitrojs/nitropack/commit/458ff5793a6d088c5813a05173a35675f453267d)), closes [#136](https://github.com/nitrojs/nitropack/issues/136)

### [0.3.6](https://github.com/nitrojs/nitropack/compare/v0.3.5...v0.3.6) (2022-04-22)

### Bug Fixes

- manually merge runtime config with env ([#143](https://github.com/nitrojs/nitropack/issues/143)) ([1be5ac2](https://github.com/nitrojs/nitropack/commit/1be5ac2e89035ce98f50edaa8e7c79ba4e974adf))
- respect `sourceMap` option ([#141](https://github.com/nitrojs/nitropack/issues/141)) ([e5ab741](https://github.com/nitrojs/nitropack/commit/e5ab741a1b96f91b62da4341ab3ceffd304e0f90))
- wrap dynamic import in prerender to fix windows build failure ([#134](https://github.com/nitrojs/nitropack/issues/134)) ([2be8aaf](https://github.com/nitrojs/nitropack/commit/2be8aafd04c180de861010b263d551cdb049e7b6))

### [0.3.5](https://github.com/nitrojs/nitropack/compare/v0.3.4...v0.3.5) (2022-04-20)

### Bug Fixes

- **node-server:** default production host to `0.0.0.0` ([b7c7193](https://github.com/nitrojs/nitropack/commit/b7c719349a0ee399a525937abb5905e50b0351f2))

### [0.3.4](https://github.com/nitrojs/nitropack/compare/v0.3.3...v0.3.4) (2022-04-19)

### Bug Fixes

- **prerender:** disallow routes longer than 250 chars ([c736de0](https://github.com/nitrojs/nitropack/commit/c736de038f186589237b413eb6ed9bd4e163189c))
- **prerender:** only use pathnames ([7cc02c9](https://github.com/nitrojs/nitropack/commit/7cc02c972c928537c2a19e75cfc53f7ea2e33ac6))

### [0.3.3](https://github.com/nitrojs/nitropack/compare/v0.3.2...v0.3.3) (2022-04-19)

### Bug Fixes

- provide compatibility `#nitro` as a virtual module ([6a798c6](https://github.com/nitrojs/nitropack/commit/6a798c6a1ac77c5c53f33838047f3ab5c7560787))

### [0.3.2](https://github.com/nitrojs/nitropack/compare/v0.3.1...v0.3.2) (2022-04-19)

### Features

- provide `#imports` alias and `#nitro` for backward compatibility ([ef2f216](https://github.com/nitrojs/nitropack/commit/ef2f216e48c54404c335c7995efcec85f7759c66))

### [0.3.1](https://github.com/nitrojs/nitropack/compare/v0.3.0...v0.3.1) (2022-04-19)

### Bug Fixes

- **node-server:** fix typo in import ([b5bd30b](https://github.com/nitrojs/nitropack/commit/b5bd30b4c0484f862dc9f78403248c686a6fb445))
- **prerenderer:** switch back to simple queue ([b7a65eb](https://github.com/nitrojs/nitropack/commit/b7a65eb0765e5b5a5e0644f61cf654f46565b410))

## [0.3.0](https://github.com/nitrojs/nitropack/compare/v0.2.11...v0.3.0) (2022-04-19)

### ⚠ BREAKING CHANGES

- rename `#nitro` to `#internal/nitro`
- remove `nitro:` prefix from hook names

### Features

- add layer0 preset ([b748da3](https://github.com/nitrojs/nitropack/commit/b748da36a1deb4b4550c865d64a1f97a4fb50211))
- **cache:** add `staleMaxAge` option for caching header ([#116](https://github.com/nitrojs/nitropack/issues/116)) ([8ff6836](https://github.com/nitrojs/nitropack/commit/8ff6836805842a7649d12f4a450d142cf329fa08))
- netlify edge function preset ([feebf8f](https://github.com/nitrojs/nitropack/commit/feebf8f6fda08873452c826e89327db380a495c7))
- stormkit preset ([#103](https://github.com/nitrojs/nitropack/issues/103)) ([7316385](https://github.com/nitrojs/nitropack/commit/7316385ea921fd33f89e4743cf3058898537f454))

### Bug Fixes

- default fetch baseURL to runtime nitro base ([#122](https://github.com/nitrojs/nitropack/issues/122)) ([00a15c1](https://github.com/nitrojs/nitropack/commit/00a15c159b2f3601d7fc3c53cc7ee423f910cf8c))
- **externals:** normalize output paths to flat structure ([a7f451f](https://github.com/nitrojs/nitropack/commit/a7f451fddf6bf7031b24eed14e707430271deda9)), closes [#106](https://github.com/nitrojs/nitropack/issues/106)
- force preset to `nitro-dev` when `dev` flag used ([94fc531](https://github.com/nitrojs/nitropack/commit/94fc53118e411bc538d61dacac70d1d1183b5004)), closes [#121](https://github.com/nitrojs/nitropack/issues/121)

- remove `nitro:` prefix from hook names ([ac2f0aa](https://github.com/nitrojs/nitropack/commit/ac2f0aa30ff1a584a2144f879d0d8caacece0add))
- rename `#nitro` to `#internal/nitro` ([944a348](https://github.com/nitrojs/nitropack/commit/944a34822c8eb4a4f6e31f285f8a64694372d657))

### [0.2.11](https://github.com/nitrojs/nitropack/compare/v0.2.10...v0.2.11) (2022-04-15)

### Bug Fixes

- **prerender:** add `.html` for implicit html routes ([1b7bc8c](https://github.com/nitrojs/nitropack/commit/1b7bc8c999004b64d2c063c8944928d9c6337e07))

### [0.2.10](https://github.com/nitrojs/nitropack/compare/v0.2.9...v0.2.10) (2022-04-14)

### Features

- **cache:** rewrite `defineCachedEventHandler` ([d7512be](https://github.com/nitrojs/nitropack/commit/d7512befd26880232c767d5fc135b4db86091853))
- improve prerenderer ([5457a01](https://github.com/nitrojs/nitropack/commit/5457a010c188f412bed0914c44db27cbe02a664b))

### [0.2.9](https://github.com/nitrojs/nitropack/compare/v0.2.8...v0.2.9) (2022-04-14)

### Bug Fixes

- **prerender:** only extract relative links ([#112](https://github.com/nitrojs/nitropack/issues/112)) ([b61caf7](https://github.com/nitrojs/nitropack/commit/b61caf78f14e772edd229d8bbf49d695bf4d8f88))

### [0.2.8](https://github.com/nitrojs/nitropack/compare/v0.2.7...v0.2.8) (2022-04-13)

### Features

- add render, digital-ocean and heroku presets ([#55](https://github.com/nitrojs/nitropack/issues/55)) ([b77ef27](https://github.com/nitrojs/nitropack/commit/b77ef277679e50565c1f9c47d0fd849cf0e1940c))

### Bug Fixes

- **dev:** remove global serve-placeholder ([7b4f340](https://github.com/nitrojs/nitropack/commit/7b4f340492ba452c9c2f9261e86925acf00dbd21)), closes [#94](https://github.com/nitrojs/nitropack/issues/94)
- **dev:** watch routes changes to full reload ([9d1ff93](https://github.com/nitrojs/nitropack/commit/9d1ff9307b32062fff786a80d0e6545f890cdc8e))
- escape regex for wild-card route matcher ([41e27b4](https://github.com/nitrojs/nitropack/commit/41e27b466ec29bdba0ecda4961be146c4a630333)), closes [nuxt/framework#4313](https://github.com/nuxt/framework/issues/4313)
- remove `/index` from generated routes at last ([09cad09](https://github.com/nitrojs/nitropack/commit/09cad098cbed3591f3cede0ac65b38a5397ff9c4)), closes [nuxt/framework#4314](https://github.com/nuxt/framework/issues/4314)
- **server-assets:** assets behavior ([#105](https://github.com/nitrojs/nitropack/issues/105)) ([e21134c](https://github.com/nitrojs/nitropack/commit/e21134c172961026e62b4840fd9005bbe03c5077))

### [0.2.7](https://github.com/nitrojs/nitropack/compare/v0.2.6...v0.2.7) (2022-04-12)

### Bug Fixes

- **rollup:** also match moduleSideEffects with full path ([ce2e898](https://github.com/nitrojs/nitropack/commit/ce2e898beaaa32776d1dabe1d96a3debea2bbabf))

### [0.2.6](https://github.com/nitrojs/nitropack/compare/v0.2.5...v0.2.6) (2022-04-12)

### Bug Fixes

- resolve to tested version of `defu` and `h3` ([ba2e237](https://github.com/nitrojs/nitropack/commit/ba2e237b5dc95ba9681dc33afd2e1898638e16f8))

### [0.2.5](https://github.com/nitrojs/nitropack/compare/v0.2.4...v0.2.5) (2022-04-12)

### Features

- allow overriding nested runtime config ([#65](https://github.com/nitrojs/nitropack/issues/65)) ([27fb68b](https://github.com/nitrojs/nitropack/commit/27fb68b0411b967069e3eb60a762b12a7b979ea2))
- support custom error and dev error handler ([#76](https://github.com/nitrojs/nitropack/issues/76)) ([cb6a84c](https://github.com/nitrojs/nitropack/commit/cb6a84c37fc1e4686b1e98a7320e44b1d7ed90d9))

### Bug Fixes

- allow overriding nested variables ([#75](https://github.com/nitrojs/nitropack/issues/75)) ([d7bfc96](https://github.com/nitrojs/nitropack/commit/d7bfc9660c8a9662b13cfb24342d3ccc9289d46a))
- allow users to override nitro error ([#58](https://github.com/nitrojs/nitropack/issues/58)) ([aa660c7](https://github.com/nitrojs/nitropack/commit/aa660c7faf92ddceee7b003c89adf1df7068bf93))

### [0.2.4](https://github.com/nitrojs/nitropack/compare/v0.2.3...v0.2.4) (2022-04-11)

### Bug Fixes

- **prerender:** use pathname from extracted links only ([#74](https://github.com/nitrojs/nitropack/issues/74)) ([b9271d7](https://github.com/nitrojs/nitropack/commit/b9271d72a182839eadc49e0c32d2beb64f1da37b))

### [0.2.3](https://github.com/nitrojs/nitropack/compare/v0.2.2...v0.2.3) (2022-04-11)

### Features

- use `std-env` to detect provider ([#72](https://github.com/nitrojs/nitropack/issues/72)) ([e78f598](https://github.com/nitrojs/nitropack/commit/e78f5984dd9b308d86adba8410b6b30336d07945))

### Bug Fixes

- always apply `#build` windows fix when `externals.trace` is disabled ([1ec2ee4](https://github.com/nitrojs/nitropack/commit/1ec2ee4cf3dfd355a2b7d8d6d7aa5de6dcb51b7c))

### [0.2.2](https://github.com/nitrojs/nitropack/compare/v0.2.1...v0.2.2) (2022-04-11)

### Bug Fixes

- disable externals with explicit flag ([2e5de6c](https://github.com/nitrojs/nitropack/commit/2e5de6cf37f4954cbd1492212f4537c44ab681e4)), closes [nuxt/framework#226](https://github.com/nuxt/framework/issues/226)
- normalize `#build` windows path for dev and prerender presets ([#70](https://github.com/nitrojs/nitropack/issues/70)) ([ec5db11](https://github.com/nitrojs/nitropack/commit/ec5db11f7eef215d0337401b91c71e1946a30664))

### [0.2.1](https://github.com/nitrojs/nitropack/compare/v0.2.0...v0.2.1) (2022-04-07)

### Bug Fixes

- use file:// for windows #build alias on dev ([077b511](https://github.com/nitrojs/nitropack/commit/077b5118742c822223fa110e0fd19f36b8616b02))

## [0.2.0](https://github.com/nitrojs/nitropack/compare/v0.1.4...v0.2.0) (2022-04-07)

### ⚠ BREAKING CHANGES

- remove `nitro:document` hook
- remove `views/app.template.html` from `build` logic

- remove `nitro:document` hook ([1feb644](https://github.com/nitrojs/nitropack/commit/1feb6444ccc9e90668a1adc13a48198891f98f2a))
- remove `views/app.template.html` from `build` logic ([0939233](https://github.com/nitrojs/nitropack/commit/09392330a8f13a51e245c0346e7a4aa66dae1b85))

### [0.1.4](https://github.com/nitrojs/nitropack/compare/v0.1.3...v0.1.4) (2022-04-07)

### Bug Fixes

- issues with firebase dependencies ([#48](https://github.com/nitrojs/nitropack/issues/48)) ([3498d7d](https://github.com/nitrojs/nitropack/commit/3498d7d369df206f04e946335e4798ad60bcf2e6))

### [0.1.3](https://github.com/nitrojs/nitropack/compare/v0.1.2...v0.1.3) (2022-04-07)

### Features

- allow user configured dynamic virtual imports ([046d090](https://github.com/nitrojs/nitropack/commit/046d0901903bb09e2e1e3812eb433e7cfa9c6141))
- improve error pages ([209688f](https://github.com/nitrojs/nitropack/commit/209688f90c72948073fe5165f03b2ef81acf865e))

### Bug Fixes

- avoid replaceAll for node 14 compatibility ([#42](https://github.com/nitrojs/nitropack/issues/42)) ([e229115](https://github.com/nitrojs/nitropack/commit/e229115454ad29826f4e27f85edbc62d22574309))
- **externals:** check for explicit externals ([b4ced48](https://github.com/nitrojs/nitropack/commit/b4ced481f3579141106f90c1f6c03bcad9a6f117))
- **externals:** improve fallback error handling ([6b355ca](https://github.com/nitrojs/nitropack/commit/6b355ca6f767e9bce95ea018a84959cb2760db63))
- update azure SWA preset and update node versions detection ([#43](https://github.com/nitrojs/nitropack/issues/43)) ([19c784b](https://github.com/nitrojs/nitropack/commit/19c784b297ef7b1a618ca2bac1656462802df144))
- update firebase output for package.json ([#45](https://github.com/nitrojs/nitropack/issues/45)) ([7700500](https://github.com/nitrojs/nitropack/commit/7700500d04c333858b94be796b6385e08a4dce70))

### [0.1.2](https://github.com/nitrojs/nitropack/compare/v0.1.1...v0.1.2) (2022-04-07)

### Bug Fixes

- update azure functions preset ([#41](https://github.com/nitrojs/nitropack/issues/41)) ([c552906](https://github.com/nitrojs/nitropack/commit/c552906b847bf1698ee6b9cb9d424aef7fc33832))

### [0.1.1](https://github.com/nitrojs/nitropack/compare/v0.1.0...v0.1.1) (2022-04-07)

### Features

- `routes/` directory ([2f96340](https://github.com/nitrojs/nitropack/commit/2f963403b2bd39493c1dc918ec1ef0a534185c06))
- method support for rotue handlers ([da35ab1](https://github.com/nitrojs/nitropack/commit/da35ab19aeaa33ea7f4ef52f9ee08bdec931fba5))
- register `[...].ext` as catch-all ([2e2e283](https://github.com/nitrojs/nitropack/commit/2e2e28342375dd03c84020085b488af67406553d))

### Bug Fixes

- also check for assets paths for `isPublicAssetURL` ([4170f65](https://github.com/nitrojs/nitropack/commit/4170f65056590075424f4d5cd5e14f9d1ad3ceed))
- always enable publicAssets plugin ([a78e1be](https://github.com/nitrojs/nitropack/commit/a78e1beb07009b59df437b80e9883db04d9d24f4))
- **cli:** prerender before main build ([9388b7d](https://github.com/nitrojs/nitropack/commit/9388b7dea3af8c0ac34e1ed5315d63f7e191a4ba))
- mock readAsset when serveStatic is disabled ([e95b9d9](https://github.com/nitrojs/nitropack/commit/e95b9d9e84b6e589a2db4a91b523eaad60654994))
- **service-worker:** remove `_server` prefix ([60ae8ba](https://github.com/nitrojs/nitropack/commit/60ae8ba5383dcceae52bf4094e4a3cc6a541d634))
- update unenv to fix proxy mock issues ([fefd2e9](https://github.com/nitrojs/nitropack/commit/fefd2e9216da0b0287ed082578c34045bb62c309))

## 0.1.0 (2022-04-07)

### ⚠ BREAKING CHANGES

- use `app.baseURL` runtime config for framework agnostic usage
- expose `nitroApp` to entries
- simplify storage options
- drop paths and support top level `baseURL` option
- migrate to h3 0.5x with events API (#23)
- add `engines.node` field and node.js version check (#1197)

### Features

- `@nuxt/meta` module for head rendering ([#179](https://github.com/nitrojs/nitropack/issues/179)) ([1a76f60](https://github.com/nitrojs/nitropack/commit/1a76f6057d893d26e41960c0b12d9cf1e9496764))
- `h3` auto imports preset ([0661fa9](https://github.com/nitrojs/nitropack/commit/0661fa988e0dafff8a700ee0c1cb10137914ccb5))
- `nitro.close()` ([c1560d0](https://github.com/nitrojs/nitropack/commit/c1560d0a7bc063a487e924e340d50202ef9c6fa0))
- add `engines.node` field and node.js version check ([#1197](https://github.com/nitrojs/nitropack/issues/1197)) ([a0ff933](https://github.com/nitrojs/nitropack/commit/a0ff933f75e4c07ac62bf1962ab3a1520fe2f094))
- add `process.dev` ([#16](https://github.com/nitrojs/nitropack/issues/16)) ([68fc5b3](https://github.com/nitrojs/nitropack/commit/68fc5b32524964a5d899e39d3a5a090eb0d1e465))
- add `runtime/client` for $fetch polyfill ([#11](https://github.com/nitrojs/nitropack/issues/11)) ([e241e3d](https://github.com/nitrojs/nitropack/commit/e241e3d770127d325ba6bfbeb74bb1adb0552e1a))
- add $fetch to client ([48cf97c](https://github.com/nitrojs/nitropack/commit/48cf97c4244680c60af99ffee7e834e5cf604070))
- add azure functions preset ([#45](https://github.com/nitrojs/nitropack/issues/45)) ([15b20a5](https://github.com/nitrojs/nitropack/commit/15b20a5c22684f49bf18931427a0ab45d4744ab3))
- add basic html error ([d090aac](https://github.com/nitrojs/nitropack/commit/d090aac99d741bbf5b965988084111aedc594d2f))
- add firebase preset ([#100](https://github.com/nitrojs/nitropack/issues/100)) ([750fa76](https://github.com/nitrojs/nitropack/commit/750fa76a33a5a2bc344bb1d0a01441f83da80f25))
- add hint to dynamic require for netlify ([5fade11](https://github.com/nitrojs/nitropack/commit/5fade11011fe4878f61f7d4ac986926540fc19fb))
- add serve-placeholder ([689aad0](https://github.com/nitrojs/nitropack/commit/689aad00155e5c153e5ee015493c81f3fb039b83))
- add support for Azure static web apps ([#92](https://github.com/nitrojs/nitropack/issues/92)) ([9a5ae67](https://github.com/nitrojs/nitropack/commit/9a5ae67e9b07ec3948703286eb207e80197a93a5))
- add support for vite build (with vite-format manifest) ([#450](https://github.com/nitrojs/nitropack/issues/450)) ([002469a](https://github.com/nitrojs/nitropack/commit/002469aae22aa965955bf9424597c4aca09b2352))
- allow custom error handling ([#30](https://github.com/nitrojs/nitropack/issues/30)) ([ac1b093](https://github.com/nitrojs/nitropack/commit/ac1b0936f712d6138f4add5e2dcbca63d3ad68e2))
- allow disabling tsconfig generation ([f30a026](https://github.com/nitrojs/nitropack/commit/f30a02667ca94415045a7071ed44c5f2196809b4))
- allow overriding runtime config with `NITRO_` or an alternative specified with `NITRO_ENV_PREFIX_ALT` ([a27d529](https://github.com/nitrojs/nitropack/commit/a27d52908848edb80f003c448daf366c98ceffd1))
- auto imports for `useConfig` and `useStorage` ([5b2c950](https://github.com/nitrojs/nitropack/commit/5b2c950209821c4d74bb68be6892ca4ec9ff3d40))
- automatically mock unresolved externals ([dac74e1](https://github.com/nitrojs/nitropack/commit/dac74e1b5c848bb13fcdf37c15c6e3f4b6c7fa00))
- aws APIGatewayProxyEventV2 support ([d135f01](https://github.com/nitrojs/nitropack/commit/d135f01be8303089a0f010d69e57cc44ad08b792))
- basic multi dir support ([376d349](https://github.com/nitrojs/nitropack/commit/376d3496ec08633aed7ad8fb8488cd3551168b4d))
- basic support for netlify_builder target ([#18](https://github.com/nitrojs/nitropack/issues/18)) ([4f90f95](https://github.com/nitrojs/nitropack/commit/4f90f959386e5a659401650be7a0f61934333afb))
- better error handler ([d8cf235](https://github.com/nitrojs/nitropack/commit/d8cf2355b0e13c121df4084fbd5d2be7c9d7ad2a))
- better process polyfill ([f06a437](https://github.com/nitrojs/nitropack/commit/f06a4376c35e1afec372fd6bd4ad9c79be76e732))
- **browser:** inject script to js template ([51712ad](https://github.com/nitrojs/nitropack/commit/51712ad0d2e18294a03a941c67611a2df1c3f06b))
- cache api ([e9a44f5](https://github.com/nitrojs/nitropack/commit/e9a44f57f6c7cbacad35e7be25f278a5fbb2c67e))
- create `nitro.logger` to control verbosity ([a91fd52](https://github.com/nitrojs/nitropack/commit/a91fd5218253c8a9e3a2c62d9810462b1428f171))
- define nitro `#storage` and `#assets` types ([#1377](https://github.com/nitrojs/nitropack/issues/1377)) ([cf78609](https://github.com/nitrojs/nitropack/commit/cf78609d4c56ea996cb002f144f391c6ee93f829))
- **deps:** update all non-major dependencies ([#2252](https://github.com/nitrojs/nitropack/issues/2252)) ([1b2e92e](https://github.com/nitrojs/nitropack/commit/1b2e92e671adb5fc84fd673bdfa15b4f08a563d3))
- detect target ([ea250b3](https://github.com/nitrojs/nitropack/commit/ea250b36a4d86914bef58c88d47c2fce1b424b3d))
- dev server watch ([3eb6c20](https://github.com/nitrojs/nitropack/commit/3eb6c20a1a1d3eb23ae0d1a775829363da0d4b8b))
- drop paths and support top level `baseURL` option ([913f3d8](https://github.com/nitrojs/nitropack/commit/913f3d8904f26d68ce7786a0f728371777faca76))
- dynamic chunk importer ([0f179ab](https://github.com/nitrojs/nitropack/commit/0f179ab120d4d4a99b755dc5eebc84d49eac30e7))
- dynamic-require rollup plugin ([b00cfb9](https://github.com/nitrojs/nitropack/commit/b00cfb93a5170af04676de5257ee62b312c423f1))
- enable externals.trace by default ([303debd](https://github.com/nitrojs/nitropack/commit/303debdf24f5666882cb7f4481840476c0c91950))
- export `defineNuxtConfig` from `nuxt3` and `@nuxt/bridge` ([#669](https://github.com/nitrojs/nitropack/issues/669)) ([8a02ab8](https://github.com/nitrojs/nitropack/commit/8a02ab812b043aa15da20d80be44572714cb083e))
- expose `useNitroApp` to access nitroApp ([3d82df1](https://github.com/nitrojs/nitropack/commit/3d82df1a654b5099102ec2dc9e9bedd50a90800c))
- expose process.env.SIGMA_PRESET ([8bdcc43](https://github.com/nitrojs/nitropack/commit/8bdcc4356714b0908b603e59aad0615f0cb2058b))
- **external:** improved subpath detection for externals ([d13b842](https://github.com/nitrojs/nitropack/commit/d13b842e42b9c3304e333957d4bc4f7317f95205))
- **externals:** smartly pick latest version and warn only on two different major ([cb03c96](https://github.com/nitrojs/nitropack/commit/cb03c96ce6abbd76714e381c9252e667d7486e9f))
- **externals:** write bundledDependencies and detect duplicate versions ([a898c8d](https://github.com/nitrojs/nitropack/commit/a898c8dc20d6748de83b2edec87ec88f868ff3f3))
- generate `.nitro/types/tsconfig.json` ([9494520](https://github.com/nitrojs/nitropack/commit/9494520769f52a8c3fc652a42ad08236a0018d29))
- generate meaningful chunkNames ([9e22f68](https://github.com/nitrojs/nitropack/commit/9e22f68aa1c5ec621339d4f9544d259983a11698))
- generate public (dist/) ([5f92307](https://github.com/nitrojs/nitropack/commit/5f92307ab8206d079d185618e258d012dca8ffa9))
- generic devHandler support ([9175a34](https://github.com/nitrojs/nitropack/commit/9175a34df6d02ecbcb1c7e5079025a1050e97cc4))
- handle api routes with router ([38b6631](https://github.com/nitrojs/nitropack/commit/38b66317dddb1ecb9d2a815268c29fa7f3a78ffb))
- handle caching headers for cachfied handlers ([ace355b](https://github.com/nitrojs/nitropack/commit/ace355b9e25235e24c21557e1a44e38a80d2a769))
- improve base url options ([#2655](https://github.com/nitrojs/nitropack/issues/2655)) ([9d8cf91](https://github.com/nitrojs/nitropack/commit/9d8cf9199e478b4eb99bc1dda3aea32bc6753e8f))
- improve cache support for event handlers ([9b4b01a](https://github.com/nitrojs/nitropack/commit/9b4b01af91aa99028140d19e6889a8570e83d835))
- improve dev error handling ([298a36b](https://github.com/nitrojs/nitropack/commit/298a36b99bc6d3104d1022e5ce443a32aadc6470))
- improve mocking ([e76cb19](https://github.com/nitrojs/nitropack/commit/e76cb19dc21462a375857676009b5fad174a629c))
- improve mocks ([6f411b2](https://github.com/nitrojs/nitropack/commit/6f411b2aa46d9de7605c8fea1938b57c44e957ac))
- improve types ([#6](https://github.com/nitrojs/nitropack/issues/6)) ([b982ae2](https://github.com/nitrojs/nitropack/commit/b982ae22bb6419df1f01260f250fcd052876858d))
- improved env support ([0c22cbe](https://github.com/nitrojs/nitropack/commit/0c22cbed3ce1a20e6b4533c72cd46b4c1b0275b0))
- improved externals and experimental trace with vercel/nft ([bc649ba](https://github.com/nitrojs/nitropack/commit/bc649ba948d9a1cccf23edd1a5169efdfb67e178))
- improved sever timing ([95e4538](https://github.com/nitrojs/nitropack/commit/95e45389cba4ee1ac63b36deb55ccb43df59d6fb))
- initial version of nu cli ([#54](https://github.com/nitrojs/nitropack/issues/54)) ([47f4198](https://github.com/nitrojs/nitropack/commit/47f4198206eb90f0dab3797e773fbfff98963285))
- inject sw script to pages ([b215c38](https://github.com/nitrojs/nitropack/commit/b215c38dddd4f319ffb3936df96dae7ecbf3df75))
- integrate $fetch with ohmyfetch ([c0fc176](https://github.com/nitrojs/nitropack/commit/c0fc17635f68b0473b00879eda3211b8802789cb))
- link crawling support ([462398f](https://github.com/nitrojs/nitropack/commit/462398f57c9bcd4886d614e060085a7264b1e525))
- load and extend config/preset with c12 ([e18211a](https://github.com/nitrojs/nitropack/commit/e18211a7cac4895af148bfd70e0856ca80bdb6ca))
- make browser target working again ([7c35713](https://github.com/nitrojs/nitropack/commit/7c357136e2591361e0706f6d7cd9efdc03daf808))
- make cloudflare working ([2ed7b35](https://github.com/nitrojs/nitropack/commit/2ed7b35fd813e7c7cb602581337eac4b74a5e62d))
- migrate to h3 0.5x with events API ([#23](https://github.com/nitrojs/nitropack/issues/23)) ([c705dd4](https://github.com/nitrojs/nitropack/commit/c705dd4893b9a127eb6c46797fb8039c1037f2cf))
- mock debug ([#118](https://github.com/nitrojs/nitropack/issues/118)) ([54bb024](https://github.com/nitrojs/nitropack/commit/54bb024b57a24382bd9863ef177e649250f857d4)), closes [#97](https://github.com/nitrojs/nitropack/issues/97)
- mock mime packages and fix v1 compat ([c960a22](https://github.com/nitrojs/nitropack/commit/c960a22d64069cfb2394f46856b9b273f239c012))
- mock stream ([435ce77](https://github.com/nitrojs/nitropack/commit/435ce7776683ba4d97a2362fe8dde949ddf0f01e))
- module utils and improvements ([#38](https://github.com/nitrojs/nitropack/issues/38)) ([58605e2](https://github.com/nitrojs/nitropack/commit/58605e2faddb6447e3b1f7f67bd5f383c4c40d38))
- natively parse and import async webpack chunks ([14b9db4](https://github.com/nitrojs/nitropack/commit/14b9db424f53e657e3d36b208e5e6fc11076f5c9))
- new public asset handling ([305c498](https://github.com/nitrojs/nitropack/commit/305c49853d514ceb00342107a7affdbd9500f5f2))
- nitro app plugins ([613a559](https://github.com/nitrojs/nitropack/commit/613a559cfd7f8ab445b947f4e18b517b4d86cda9))
- nitro endpoint for viewing `_vfs` ([#362](https://github.com/nitrojs/nitropack/issues/362)) ([edd67c5](https://github.com/nitrojs/nitropack/commit/edd67c5dbbda2c07019148ff7d16f351def93438))
- **nitro, vite:** use native module ([#252](https://github.com/nitrojs/nitropack/issues/252)) ([ad7044a](https://github.com/nitrojs/nitropack/commit/ad7044a2c50b7606ed00004e10e2b42d29d836dd))
- **nitro:** #config ([d169f11](https://github.com/nitrojs/nitropack/commit/d169f116200a188d0eff3e1c7170b0cab6910421))
- **nitro:** allow extending nitro context ([4a3a253](https://github.com/nitrojs/nitropack/commit/4a3a2539bdbee9162ab28e8440b30b45a7ff965a))
- **nitro:** assets driver ([#511](https://github.com/nitrojs/nitropack/issues/511)) ([9a8d992](https://github.com/nitrojs/nitropack/commit/9a8d992dbb710f3103d5a5ce83f52c2272e1fd8e))
- **nitro:** automatically type middleware/api routes ([#708](https://github.com/nitrojs/nitropack/issues/708)) ([3163fa2](https://github.com/nitrojs/nitropack/commit/3163fa217ed16e672c12d4dde3304a683fddb7cb))
- **nitro:** handle request body in workers ([#537](https://github.com/nitrojs/nitropack/issues/537)) ([c3249cb](https://github.com/nitrojs/nitropack/commit/c3249cb6e2f7c870e4a0e78f48401c60e08a798c))
- **nitro:** improve dev worker stability ([#1303](https://github.com/nitrojs/nitropack/issues/1303)) ([f71714d](https://github.com/nitrojs/nitropack/commit/f71714d3dde83a496de404d83c651c5774ae25bb))
- **nitro:** raw loader ([#75](https://github.com/nitrojs/nitropack/issues/75)) ([5acb394](https://github.com/nitrojs/nitropack/commit/5acb394a75cbc28f2fe3c094af4452f22c493190))
- **nitro:** server assets ([#83](https://github.com/nitrojs/nitropack/issues/83)) ([f71574c](https://github.com/nitrojs/nitropack/commit/f71574cd46829836d59e334fea1cf1fe529e003c))
- **nitro:** specify packages to copy to `.output/server/node_modules` ([#2382](https://github.com/nitrojs/nitropack/issues/2382)) ([acb0033](https://github.com/nitrojs/nitropack/commit/acb00338c3798128c4d6ca533d2903fde914dbeb))
- **nitro:** ssl nitro support in production ([#2742](https://github.com/nitrojs/nitropack/issues/2742)) ([9c48d73](https://github.com/nitrojs/nitropack/commit/9c48d73e59c9e68d0f471b2902847938a3d1d954))
- **nitro:** storage support ([#76](https://github.com/nitrojs/nitropack/issues/76)) ([958563c](https://github.com/nitrojs/nitropack/commit/958563c0e9da1b86419776686471fd1a51759078))
- **nitro:** support adding `node_modules` as middleware ([#2826](https://github.com/nitrojs/nitropack/issues/2826)) ([75d2674](https://github.com/nitrojs/nitropack/commit/75d2674ca1f24e7fc5c5e94b4ba0969d4bf65e16))
- **nitro:** support esbuild options config ([#550](https://github.com/nitrojs/nitropack/issues/550)) ([bff7db3](https://github.com/nitrojs/nitropack/commit/bff7db3a61a52c009c037006a42537e20a5b5db2))
- **nitro:** support importing/inlining wasm binaries ([#693](https://github.com/nitrojs/nitropack/issues/693)) ([a0ddbd2](https://github.com/nitrojs/nitropack/commit/a0ddbd2e16b0a0028541e74c4e727190352b16be))
- **nitro:** support netlify zero-config deployments ([#175](https://github.com/nitrojs/nitropack/issues/175)) ([ced37c2](https://github.com/nitrojs/nitropack/commit/ced37c20839dab4df9c7b0ae9358a34fc90dd593))
- **nitro:** update dependencies for node-fetch 3.x support ([#1373](https://github.com/nitrojs/nitropack/issues/1373)) ([9d12b7e](https://github.com/nitrojs/nitropack/commit/9d12b7e7ddf28d5f6322b7ae5047117d10d411c0))
- **nuxi:** add `nuxi preview` command for local testing ([#2162](https://github.com/nitrojs/nitropack/issues/2162)) ([b60a23a](https://github.com/nitrojs/nitropack/commit/b60a23ae61f3050ad3b467dc09bd5b189458ca9b))
- **nuxi:** bundle analyzer ([#701](https://github.com/nitrojs/nitropack/issues/701)) ([5364d04](https://github.com/nitrojs/nitropack/commit/5364d0444ccc5353c8152623b6590d6bbc8efb1e))
- nuxt bridge ([#459](https://github.com/nitrojs/nitropack/issues/459)) ([3de9574](https://github.com/nitrojs/nitropack/commit/3de9574cf827c11d3a4d3e6805b3eba388d76cf8))
- **nuxt3, bridge:** useRuntimeConfig ([#625](https://github.com/nitrojs/nitropack/issues/625)) ([832a9a4](https://github.com/nitrojs/nitropack/commit/832a9a44a246f5f9e50f57270561ae5d53fbcd1f))
- **nuxt3:** `useFetch` ([#721](https://github.com/nitrojs/nitropack/issues/721)) ([9b76832](https://github.com/nitrojs/nitropack/commit/9b768326aae4eaa7fb329f13071a110c50720d1e))
- optional pages and refactor nuxt3 ([#142](https://github.com/nitrojs/nitropack/issues/142)) ([39a0c4a](https://github.com/nitrojs/nitropack/commit/39a0c4a48617350bc03290b3b5dcd86afcae1338))
- prerender support ([24fb151](https://github.com/nitrojs/nitropack/commit/24fb1516bd14c19cb4e17e60de55f48dcd633efc))
- reexport common utils from `#nitro` index ([3dc2ee6](https://github.com/nitrojs/nitropack/commit/3dc2ee6d92bec9f4ece00f457887303053379298))
- resolve aliases with reference to themselves ([#26](https://github.com/nitrojs/nitropack/issues/26)) ([adb6c5d](https://github.com/nitrojs/nitropack/commit/adb6c5d1c7820feef63ed0851d7850f04d98ebb1))
- resolve externals with full path ([1c9b627](https://github.com/nitrojs/nitropack/commit/1c9b627f450eba8015f61e6224020e18a168812d))
- rewrite as nuxt module ([6881079](https://github.com/nitrojs/nitropack/commit/68810798975e49c041352741c08bdde09f9be6aa))
- **rollup:** allow custom replace entries ([18ee71b](https://github.com/nitrojs/nitropack/commit/18ee71b982d9ac8c15bdc2c374b860268fd2893c))
- serve-placeholder ([7a59183](https://github.com/nitrojs/nitropack/commit/7a591834193b85ef96d5dfa3a4bf3d8259883247))
- serveStatic ([#47](https://github.com/nitrojs/nitropack/issues/47)) ([af42712](https://github.com/nitrojs/nitropack/commit/af427122cd0733f5a2c115bdaef3557bb2478cd2))
- show fs tree for output ([a230bc7](https://github.com/nitrojs/nitropack/commit/a230bc7bbd25b7335b7104e70461e9bf61db95ae))
- sigma.client ([1656155](https://github.com/nitrojs/nitropack/commit/16561554610d56ad2a2fa25e3e9d6bb407a9b527))
- sourcemap support ([e47b266](https://github.com/nitrojs/nitropack/commit/e47b266c69c576b54795108e986faece6ed3e8b6))
- ssr with service worker ([971315c](https://github.com/nitrojs/nitropack/commit/971315c797c9c210b3966e3539da3d3c77415049))
- support `NITRO_APP_BASE_URL` for build-time ([42ff5a3](https://github.com/nitrojs/nitropack/commit/42ff5a383a6d27eb6d66585171eac4cd7c6c4a0f))
- support `ssr: false` ([#351](https://github.com/nitrojs/nitropack/issues/351)) ([ddc045e](https://github.com/nitrojs/nitropack/commit/ddc045e0a6586c689a87c9a7d5aa4061600b098d))
- support dynamic chunks, lazy middleware and cjs target ([0caa11e](https://github.com/nitrojs/nitropack/commit/0caa11ee2113bcddf662224ba4aaf26362a3e51d))
- support overriding nested runtime config ([#2](https://github.com/nitrojs/nitropack/issues/2)) ([b9cdcbd](https://github.com/nitrojs/nitropack/commit/b9cdcbd1357c7dd3c554320a561b79a16597ba7e))
- support runtimeConfig (closes [#43](https://github.com/nitrojs/nitropack/issues/43)) ([5677d86](https://github.com/nitrojs/nitropack/commit/5677d86d8ee06290511abbc6f6600d6d2a5cfb98))
- support server directory ([#132](https://github.com/nitrojs/nitropack/issues/132)) ([cda0aa4](https://github.com/nitrojs/nitropack/commit/cda0aa47891aec8becec2620ae2faec7a803a723))
- support serverMiddleware ([e5cd009](https://github.com/nitrojs/nitropack/commit/e5cd009e537b00cb16a032d72abfe21db1605bdd))
- support serverMiddleware ([#26](https://github.com/nitrojs/nitropack/issues/26)) ([c99316f](https://github.com/nitrojs/nitropack/commit/c99316f8c98045f1cd2cacda4622d4d122aaf7a0))
- support serverMiddleware ([#26](https://github.com/nitrojs/nitropack/issues/26)) ([92e5015](https://github.com/nitrojs/nitropack/commit/92e5015aff81ad1e785985fdb0058f718bbb2555))
- support ssrContext.head ([8bcf6fb](https://github.com/nitrojs/nitropack/commit/8bcf6fb74b935c673a5f88a1c35b6327cb48a78b))
- support staticAssetsBase ([aca8be7](https://github.com/nitrojs/nitropack/commit/aca8be7d1eb3eb0866dc29dd681d5b807fe1382c))
- support target functions to consume nuxtOptions ([725caec](https://github.com/nitrojs/nitropack/commit/725caecb1518b4195dd2024757c7272d2e8c5c03))
- support typescript via esbuild (closes [#42](https://github.com/nitrojs/nitropack/issues/42)) ([3dd5276](https://github.com/nitrojs/nitropack/commit/3dd5276d008506c2843b951a3120b4f47012f81c))
- support universalFetch during generate ([f656d3f](https://github.com/nitrojs/nitropack/commit/f656d3f72760b8d31fa21f9f8f4b6ea353ab55c2))
- swr support with route rules ([4e37f23](https://github.com/nitrojs/nitropack/commit/4e37f2319932bc2c4067d01f4bf95cba11a9c9fd))
- switch to h2 stack for dev server ([4dfca5a](https://github.com/nitrojs/nitropack/commit/4dfca5ac874e8d74761c270286a3f0e83fd165be))
- timing plugin and Server-Timing ([424ce0a](https://github.com/nitrojs/nitropack/commit/424ce0af0edb88970650ab31984fc49fd2d1ad50))
- unimport support for server api ([#15](https://github.com/nitrojs/nitropack/issues/15)) ([9fc9e03](https://github.com/nitrojs/nitropack/commit/9fc9e032caca71843bbfb8eabf612fbc1d2068e9))
- update preset options ([12e1291](https://github.com/nitrojs/nitropack/commit/12e1291df6e3f9741449f7ae0aa888e437d0e186))
- update vercel and improve internals ([9b5ac28](https://github.com/nitrojs/nitropack/commit/9b5ac280f3ab5923e90fad7df3684488cf4a506f))
- use `@nuxt/design` ([#322](https://github.com/nitrojs/nitropack/issues/322)) ([b9a7033](https://github.com/nitrojs/nitropack/commit/b9a7033e4968fe9526bb93f50926aed265148a2e))
- use dynamic require for node targets ([a67944f](https://github.com/nitrojs/nitropack/commit/a67944fd83a139384f98829363d1f3055d3e1e3e))
- use h2@10 ([8ce644a](https://github.com/nitrojs/nitropack/commit/8ce644acc36ef02e855c5cb1bf361c75693e0e64))
- use native esm for all packages ([#539](https://github.com/nitrojs/nitropack/issues/539)) ([cf4d593](https://github.com/nitrojs/nitropack/commit/cf4d59378355e0633cd942ed9737fe52ecd7a0cf))
- use virtual filesystem for templates ([#292](https://github.com/nitrojs/nitropack/issues/292)) ([b0a9bd2](https://github.com/nitrojs/nitropack/commit/b0a9bd27516e5d5f37aead42b5ccd218064b479d))
- use webpack esm server build ([#474](https://github.com/nitrojs/nitropack/issues/474)) ([009579a](https://github.com/nitrojs/nitropack/commit/009579a8bb60de0767e2a9d65977f52c527a9909))
- **vite:** vite dev server bundler ([#604](https://github.com/nitrojs/nitropack/issues/604)) ([fb91ed2](https://github.com/nitrojs/nitropack/commit/fb91ed2d1847d9759036f0c99c13a67a0c16c814))
- whitelist static routes ([377a965](https://github.com/nitrojs/nitropack/commit/377a9659fc230a9153801e5da7b07ec887e9726c))
- **worker:** support process.hrtime ([a5904f5](https://github.com/nitrojs/nitropack/commit/a5904f5276c653be49c65da2b42ee881db6c0cf3))
- working cloudflare with vue2 and async chunks ([0255442](https://github.com/nitrojs/nitropack/commit/02554424c4623aaa08427346954f7a2b7b026bb0))
- working poc ([6f5c475](https://github.com/nitrojs/nitropack/commit/6f5c4752c7cc8e67736914bb15e2d7eca18dc3e5))

### Bug Fixes

- \_interopDefault potential cjs files ([d873169](https://github.com/nitrojs/nitropack/commit/d873169363201fcff68a42346b40655ecd51aa05))
- 404 handling for static assets ([c0cb35d](https://github.com/nitrojs/nitropack/commit/c0cb35df099c57ccf25d92eb28d9e65fb91f0425))
- add `node_modules` from cwd to nodeResolve ([035a6e6](https://github.com/nitrojs/nitropack/commit/035a6e6ebb3c75b44cc6fc14bb03fa02bf3da38d))
- add critical css ([37f6d79](https://github.com/nitrojs/nitropack/commit/37f6d797ec83370db0540d19ded954194775f24e))
- add default route when generating code ([df694ea](https://github.com/nitrojs/nitropack/commit/df694ea391cea425aaba13fe9103bf08a86ea4fb))
- add default value for assets.dirs ([4d7c6ac](https://github.com/nitrojs/nitropack/commit/4d7c6ac1f61ecc91908644d64984bbec7a3c417f))
- add default value for buildDir and generateDir ([565a27c](https://github.com/nitrojs/nitropack/commit/565a27cc1200df4c72c499174915383b1ff554f8))
- add generate.routes and disable crawler ([ec89296](https://github.com/nitrojs/nitropack/commit/ec8929643b57b4416ba688275ea0ac3253041775))
- add hack for encoding ([20b8f22](https://github.com/nitrojs/nitropack/commit/20b8f228c468cfae1ef8ddb0a62cd715f9bca156))
- add main entrypoints for packages ([#629](https://github.com/nitrojs/nitropack/issues/629)) ([e4e69f7](https://github.com/nitrojs/nitropack/commit/e4e69f75da77094a2e9afbb64e5c4a76f544b0f6))
- add missing `#_config` ([#24](https://github.com/nitrojs/nitropack/issues/24)) ([e06573c](https://github.com/nitrojs/nitropack/commit/e06573cbe0671e3e02de8d00cccdb5690e6d9771))
- add missing default for `devHandlers` ([43b2f41](https://github.com/nitrojs/nitropack/commit/43b2f415780be257c93503c1a3fbc88e709acbd0))
- add more types ([#16](https://github.com/nitrojs/nitropack/issues/16)) ([da7bbb2](https://github.com/nitrojs/nitropack/commit/da7bbb2c2a228d201cf9452b02a47d4d373372fd))
- add nitro client plugin ($fetch support) ([#223](https://github.com/nitrojs/nitropack/issues/223)) ([93213f4](https://github.com/nitrojs/nitropack/commit/93213f4f46bd5f6dcc05c2ff1a80321bc89c7779)), closes [#213](https://github.com/nitrojs/nitropack/issues/213)
- add prefix to dynamic imports name ([#5](https://github.com/nitrojs/nitropack/issues/5)) ([eecd766](https://github.com/nitrojs/nitropack/commit/eecd7660a1842bd0be87d6d640d4c15c8c1cc229))
- add temp fix for browser ([d197716](https://github.com/nitrojs/nitropack/commit/d19771663b8312379b99b1d9b7fee245292f3134))
- addresses static assets/azure issues ([#49](https://github.com/nitrojs/nitropack/issues/49)) ([88e8bd9](https://github.com/nitrojs/nitropack/commit/88e8bd92205592d9c3335f036ee8091aa4aef9c2))
- allow matching dynamic page routes ([88d0676](https://github.com/nitrojs/nitropack/commit/88d0676358cdbfab33f4fc467b8ea0ab464c5b26))
- allow not overriding env, and allow disabling prefix ([#40](https://github.com/nitrojs/nitropack/issues/40)) ([1d6a802](https://github.com/nitrojs/nitropack/commit/1d6a80246ff9b26c59f98a0740485f1f7a38e47c))
- allow numbers in dynamic webpack chunk names ([#125](https://github.com/nitrojs/nitropack/issues/125)) ([3bfa916](https://github.com/nitrojs/nitropack/commit/3bfa916f9500dd3b166f7d687a4ff1b8ad556911))
- allow use of nuxt3 in non-wsl windows environment ([#308](https://github.com/nitrojs/nitropack/issues/308)) ([da6da9c](https://github.com/nitrojs/nitropack/commit/da6da9c2b0bd6b2a096f0e151297c7ac04121c0d))
- always mock generic dependencies ([f210304](https://github.com/nitrojs/nitropack/commit/f2103046d492d3ce9957bb9a362b847cd84e1586))
- **app, nitro:** fix `app:rendered` hook ([#53](https://github.com/nitrojs/nitropack/issues/53)) ([ecc85f0](https://github.com/nitrojs/nitropack/commit/ecc85f048368cf2f822bcc5c461c3e475d11170c))
- **app:** make `renderMeta` optional ([#340](https://github.com/nitrojs/nitropack/issues/340)) ([844cbea](https://github.com/nitrojs/nitropack/commit/844cbeaec2e093e8cea77dd691cc82d627ed831d))
- **automock:** don't externalize .ts imports ([077bf13](https://github.com/nitrojs/nitropack/commit/077bf13b64c2b48f1d95a0998cf08c24a49ecdb9))
- avoid `replaceAll` for platform compatibility ([3cde549](https://github.com/nitrojs/nitropack/commit/3cde54924170193ff527c17eac43c1a20c4bfc27))
- avoid closing on dev command ([b6cca1a](https://github.com/nitrojs/nitropack/commit/b6cca1aab5c1743d9c3b6eed0767f5c609e0516a))
- avoid overriding hooks ([d722e9f](https://github.com/nitrojs/nitropack/commit/d722e9f7892313345c000205757c62b6996261ab))
- avoid reloading worker when entry not exists ([5d3ca2f](https://github.com/nitrojs/nitropack/commit/5d3ca2fcb5811a8c057cde47c5106a9b06fdef69))
- await for reload process before responding ([f441b30](https://github.com/nitrojs/nitropack/commit/f441b30095d5a1ab8f5e7df5ecf550d593ed09fa))
- **bridge:** plugin default detection ([#1847](https://github.com/nitrojs/nitropack/issues/1847)) ([f7748e2](https://github.com/nitrojs/nitropack/commit/f7748e22e4163211f416d47a000d087d3bf4f2f1))
- **bridge:** set `app.basePath` ([#2808](https://github.com/nitrojs/nitropack/issues/2808)) ([8df7624](https://github.com/nitrojs/nitropack/commit/8df762429e24485548a38b915bd5ba9fbaba0b54))
- bring back nuxt3 support ([a87c2a5](https://github.com/nitrojs/nitropack/commit/a87c2a58913b7d8405d7a471dd1f6cacacebb0f1))
- **browser:** 400.html ~> 404.html ([7c68add](https://github.com/nitrojs/nitropack/commit/7c68add9e686b0fe234a439d8863db908902e34b))
- check for server webpack config ([#91](https://github.com/nitrojs/nitropack/issues/91)) ([03bb235](https://github.com/nitrojs/nitropack/commit/03bb23569f30b338eb0cf0650999f66430cd39a3))
- clone config and preserve overrides for prerender instance ([08c65b8](https://github.com/nitrojs/nitropack/commit/08c65b8945b3d44ea99b72ca566d8906efa00ce3))
- cloudflare and polyfill ([dc967bc](https://github.com/nitrojs/nitropack/commit/dc967bcb77a733491475ffaac4dcc1327e83ceab))
- **cloudflare, lambda:** preserve query parameters in url ([#155](https://github.com/nitrojs/nitropack/issues/155)) ([b59986d](https://github.com/nitrojs/nitropack/commit/b59986d1b89e035be3b9011041d54bb362aff040))
- **compat:** add template variables for compat module ([#162](https://github.com/nitrojs/nitropack/issues/162)) ([126920a](https://github.com/nitrojs/nitropack/commit/126920aa7c54b99453a1ef0e772ea30f10e33723))
- **compat:** cannot read property setLegacyMiddleware of undefined ([#82](https://github.com/nitrojs/nitropack/issues/82)) ([29b368e](https://github.com/nitrojs/nitropack/commit/29b368effaa6562242d007371ca4e3a2448e7138))
- **compat:** disable webpack sourcemap ([#84](https://github.com/nitrojs/nitropack/issues/84)) ([961f18d](https://github.com/nitrojs/nitropack/commit/961f18de53f8c85933e9463a4638e5ad62be036d))
- **compat:** enforce nuxt generate for static target ([#148](https://github.com/nitrojs/nitropack/issues/148)) ([8e0b095](https://github.com/nitrojs/nitropack/commit/8e0b095bb0368c77df130942189f0cca424bcbfa))
- **components:** augment 'vue' module rather than overwriting ([#305](https://github.com/nitrojs/nitropack/issues/305)) ([c631f11](https://github.com/nitrojs/nitropack/commit/c631f115dd70d9d7da31daadf85e3bc04daeae72))
- **config:** always disasble server sourceMap ([#88](https://github.com/nitrojs/nitropack/issues/88)) ([a5eb76e](https://github.com/nitrojs/nitropack/commit/a5eb76e311d5a74239b7e57333759d367e562745))
- configurable publicPath (closes [#21](https://github.com/nitrojs/nitropack/issues/21)) ([9262d64](https://github.com/nitrojs/nitropack/commit/9262d64c5598c6fdf6e87730f622435047ff98dd))
- default value for template path ([b334942](https://github.com/nitrojs/nitropack/commit/b3349428bf5d2891e24e87542b68568185c9e80a))
- **dep:** pin esbuild to 0.10.x due to module breaking changes ([879a5bc](https://github.com/nitrojs/nitropack/commit/879a5bc02d680b61ab40d697c84d466cc39e03c3))
- **deps:** update `h3` to `0.5.2` ([ce14f33](https://github.com/nitrojs/nitropack/commit/ce14f334ebe5260437acf059ce7fae6d8bdb063a))
- **deps:** update dependency ohmyfetch to ^0.4.4 ([#1705](https://github.com/nitrojs/nitropack/issues/1705)) ([27f238f](https://github.com/nitrojs/nitropack/commit/27f238fe63ff8e0a9c2b73f0ead6afcbb10bd311))
- **deps:** upgrade jiti to 2.12.9 ([#1171](https://github.com/nitrojs/nitropack/issues/1171)) ([e939b36](https://github.com/nitrojs/nitropack/commit/e939b36e31afb334e4b4d216148cead201421559))
- **dev:** add conditional check for `removeAllListeners` call ([6529f60](https://github.com/nitrojs/nitropack/commit/6529f604d4783b1922ec339c0091026ef60364b7))
- **dev:** handle unhandledRejection and uncaughtException to avoid failing worker state ([4e8a661](https://github.com/nitrojs/nitropack/commit/4e8a6610742bc2b27e5feb4bdfa1d121776e3de0))
- **dev:** use localhost for emitted host in port mode ([eb6ebdb](https://github.com/nitrojs/nitropack/commit/eb6ebdb4c475c8bffd4bf4608d93ee91be9d9378))
- disable cleanTargetDir for vercel ([9d8a95b](https://github.com/nitrojs/nitropack/commit/9d8a95b05424018bb1a76eedf9db2c732af7b751))
- disable external tracing for local preset ([0d7d102](https://github.com/nitrojs/nitropack/commit/0d7d102089dd4fb7e89313e4461d6d4c29bb0569))
- disable static manifest generation (resolves [#53](https://github.com/nitrojs/nitropack/issues/53)) ([df69cfa](https://github.com/nitrojs/nitropack/commit/df69cfa4808da3b8f867c97bc7a74a851c0eaae3))
- do not inline whole `rootDir` ([0929bcd](https://github.com/nitrojs/nitropack/commit/0929bcd651e6ab139554e0af946985765f826c56))
- don't set \_registeredComponents ([89b1958](https://github.com/nitrojs/nitropack/commit/89b1958f41f4fd5b9ec718f1f70074dc12abaf40))
- enable vue-resolution workaround ([17c3c60](https://github.com/nitrojs/nitropack/commit/17c3c60732df8b0ef70a6884fbdd53cc781e206e))
- ensure builds are relative to buildDir ([ba687f8](https://github.com/nitrojs/nitropack/commit/ba687f8c96c65cb51c1d7ecf4b561412d06969a0))
- exec require before return ([a3fb537](https://github.com/nitrojs/nitropack/commit/a3fb5372b21450833cc267bc551f2a589a2b52f8))
- expose types ([66b4973](https://github.com/nitrojs/nitropack/commit/66b4973f83b95b82a19f350c5eeb9a9e148fbce5))
- extend routes from serverless.static ([75ae176](https://github.com/nitrojs/nitropack/commit/75ae17631eed148349ecea9aebe314f2ccc5c1cd))
- **externals:** handle non pkg paths ([0831bac](https://github.com/nitrojs/nitropack/commit/0831bac1b511aaa9d8b4bf342996e76c7cdc8a78))
- **externals:** use normalizeid for external files ([b9db0e9](https://github.com/nitrojs/nitropack/commit/b9db0e932a7e6d8d2af35921d2b4355e2b0768c2))
- **externals:** windows compatibility with parseNodeModulePath ([935f39a](https://github.com/nitrojs/nitropack/commit/935f39a623406c826734e2771738113a8597136a))
- fix \_interopDefault implementation ([faa7245](https://github.com/nitrojs/nitropack/commit/faa72459271f46831e087f2b5b36601c404a57ae))
- fix error template formatting ([545ccf6](https://github.com/nitrojs/nitropack/commit/545ccf6c7e79e0832641f04b73b04e3a66c80bef))
- fix issues with router.base support ([5a7e0fa](https://github.com/nitrojs/nitropack/commit/5a7e0faf3d5ef9db11ca907df404babc0c1fdf30))
- fix mocks and disable buffer since is unnecessary ([ecdf2cd](https://github.com/nitrojs/nitropack/commit/ecdf2cd613771945acac6bf555171d2d58fff87a))
- fix preview and deploy command info ([1c1bf04](https://github.com/nitrojs/nitropack/commit/1c1bf0450a9d3ef49e5b5cc677b8bbee93d43b62))
- fix worker polyfill by adding performance ([a30fed4](https://github.com/nitrojs/nitropack/commit/a30fed4e46d4649e48ef9574e95258e4413a08c9))
- force rebuild on new files being added ([#136](https://github.com/nitrojs/nitropack/issues/136)) ([2ca8a87](https://github.com/nitrojs/nitropack/commit/2ca8a873504947d16f0f6226cbdb8ca411fcc439))
- handle decoding static file names ([#13](https://github.com/nitrojs/nitropack/issues/13)) ([5504ce9](https://github.com/nitrojs/nitropack/commit/5504ce9f3df5f54e9a70d66b2ff917b6cd26f686))
- handle if serverless is not set in config ([f055ddd](https://github.com/nitrojs/nitropack/commit/f055ddd12d780756d0ab87af0edd81e7c1f245b1))
- handle undefined error stack in production ([39ef2b3](https://github.com/nitrojs/nitropack/commit/39ef2b3854a749fecc62403e5b195d703342d231))
- hide rollup circular and eval ([e5f9900](https://github.com/nitrojs/nitropack/commit/e5f9900bc73456ddcb8a4c25649ed2d4f797c099))
- host ~> hostname ([7c663c2](https://github.com/nitrojs/nitropack/commit/7c663c20a67c8b30c434be36eefda2b3da4d61b7))
- ignore close listeners ([ae22387](https://github.com/nitrojs/nitropack/commit/ae22387c3fe6235428ad8e7000b6c92dfba2fd07))
- ignore resolving vue alias when not found ([5f12eaa](https://github.com/nitrojs/nitropack/commit/5f12eaa706a84ec1caf28a988b12ffbea40767a5))
- improve externals handling ([a5262e4](https://github.com/nitrojs/nitropack/commit/a5262e4fa998d4fe4a733ac656c23fe198b72589))
- improve prerender logs ([32ff5e4](https://github.com/nitrojs/nitropack/commit/32ff5e49b11058ffc9b91c3c55b4787ffa6693f7))
- improve type declarations ([#1178](https://github.com/nitrojs/nitropack/issues/1178)) ([a2526f7](https://github.com/nitrojs/nitropack/commit/a2526f7c10f73336c889598eac676060eab58d87))
- issues with externals outside of rootDir ([a7cbfbe](https://github.com/nitrojs/nitropack/commit/a7cbfbe1d6fe94dfc20e36370dd074a248555d9d))
- lazy is true by default ([04d28b9](https://github.com/nitrojs/nitropack/commit/04d28b9f609d5456546a2ecc112df6ec532f2354))
- less verbose logs when testing ([00177d0](https://github.com/nitrojs/nitropack/commit/00177d02b7181e990983a3527f2d2d4106bf83bb))
- load webpack modules synchronously with `require` ([#104](https://github.com/nitrojs/nitropack/issues/104)) ([c20e813](https://github.com/nitrojs/nitropack/commit/c20e81387baf2eee54718ce94ab2b4865a2d82b4))
- move hrtime polyfill to timing plugin ([fe9d073](https://github.com/nitrojs/nitropack/commit/fe9d0737b88a8219f4fa278d87df6ae800663869))
- **netlify:** update output templates ([4f46310](https://github.com/nitrojs/nitropack/commit/4f46310633d5a78b0ef618aa7e500134c20a1344))
- **nitro, nuxi:** add runtimeConfig types (for `#config` and `useRuntimeConfig()`) ([#1783](https://github.com/nitrojs/nitropack/issues/1783)) ([486be51](https://github.com/nitrojs/nitropack/commit/486be51e10871a81b83d4f80374055220abf715f))
- **nitro:** `dot-prop` esm compatibility ([#829](https://github.com/nitrojs/nitropack/issues/829)) ([f157f56](https://github.com/nitrojs/nitropack/commit/f157f5680fbac314f470c9b83629d09ce7630f0a))
- **nitro:** `table` esm compatibility (resolves [#877](https://github.com/nitrojs/nitropack/issues/877)) ([4c05a90](https://github.com/nitrojs/nitropack/commit/4c05a905b18c7a929996e432796015bd188e6457))
- **nitro:** absolute external resolution ([#80](https://github.com/nitrojs/nitropack/issues/80)) ([b03c813](https://github.com/nitrojs/nitropack/commit/b03c813e45a1bfc7684f1ab727a3aeeca3780c1c))
- **nitro:** add back compat entry ([70bf183](https://github.com/nitrojs/nitropack/commit/70bf1834e14ebe0825d7846a23cf6e6304af6345))
- **nitro:** add body + body prepended scripts to template ([#154](https://github.com/nitrojs/nitropack/issues/154)) ([f348588](https://github.com/nitrojs/nitropack/commit/f348588f7b76885431ab154be3d93fa563537787))
- **nitro:** add error logging to `initWorker`([#2090](https://github.com/nitrojs/nitropack/issues/2090)) ([9e004e1](https://github.com/nitrojs/nitropack/commit/9e004e10195d4e9a5f31ef0d35f949a044ae2693))
- **nitro:** add missing kit dependency ([dfa3d8d](https://github.com/nitrojs/nitropack/commit/dfa3d8da8a6710da31c619a6e77bad2c8fc02bfe))
- **nitro:** add temporary workarouind for ufo resolution in nuxt2 ([e5ecf6b](https://github.com/nitrojs/nitropack/commit/e5ecf6b029e657f7f097f1a8e4b19a9cb8821cc8))
- **nitro:** allow inlining subpath of externals ([#2759](https://github.com/nitrojs/nitropack/issues/2759)) ([30023f7](https://github.com/nitrojs/nitropack/commit/30023f79f745bedbe47200b07e4e913bd1ea76da))
- **nitro:** always inline `.wasm` ([#698](https://github.com/nitrojs/nitropack/issues/698)) ([e7bb03c](https://github.com/nitrojs/nitropack/commit/e7bb03ce731d1411368472915539889be68e5f87))
- **nitro:** avoid using fs/promises ([bd25e87](https://github.com/nitrojs/nitropack/commit/bd25e873b9ebf1869538265b923f7ae5a9741a2b))
- **nitro:** bundle json files ([#1245](https://github.com/nitrojs/nitropack/issues/1245)) ([adf2235](https://github.com/nitrojs/nitropack/commit/adf223590f00899d06e9b40ddaf83d037c5bfe58))
- **nitro:** correct `#assets` type declaration ([#2403](https://github.com/nitrojs/nitropack/issues/2403)) ([bc9817c](https://github.com/nitrojs/nitropack/commit/bc9817ce02c565c62885f4c9f7328f3c1bb00b11))
- **nitro:** correct issues rendering `payload.js` ([#466](https://github.com/nitrojs/nitropack/issues/466)) ([584a14d](https://github.com/nitrojs/nitropack/commit/584a14db5156a8e99261037d2c6f069fa082f69c))
- **nitro:** correct vercel fs api static directory ([#488](https://github.com/nitrojs/nitropack/issues/488)) ([cd0616e](https://github.com/nitrojs/nitropack/commit/cd0616e111cce78057f5fda7b13f793754c086db))
- **nitro:** detect `NETLIFY_LOCAL` ([#400](https://github.com/nitrojs/nitropack/issues/400)) ([f78d185](https://github.com/nitrojs/nitropack/commit/f78d1858d2e7b82467c8982716f2864f450f2ddd))
- **nitro:** detect routes and middleware starting with dots ([#2771](https://github.com/nitrojs/nitropack/issues/2771)) ([9b3d6c2](https://github.com/nitrojs/nitropack/commit/9b3d6c2dbd5300f0daa983fc6f749f6fe41f628f))
- **nitro:** disable `moduleSideEffects` by default ([#377](https://github.com/nitrojs/nitropack/issues/377)) ([ec207e9](https://github.com/nitrojs/nitropack/commit/ec207e9c9ff7e57733f9bb97df9dcfcf4511be79))
- **nitro:** disable automatic spa fallback ([#1071](https://github.com/nitrojs/nitropack/issues/1071)) ([4427b89](https://github.com/nitrojs/nitropack/commit/4427b89a69ddd469812b6324a2e45dd4bc13f904))
- **nitro:** disable externals in worker preset ([#535](https://github.com/nitrojs/nitropack/issues/535)) ([2298276](https://github.com/nitrojs/nitropack/commit/22982761af47b0e7693957d04c46a69fed5df275))
- **nitro:** do not modify `event.request` for worker entries ([#1279](https://github.com/nitrojs/nitropack/issues/1279)) ([cc9a4cd](https://github.com/nitrojs/nitropack/commit/cc9a4cd24f6acad4ae7e4183a34cd5da8e04ba06))
- **nitro:** do not overwrite output files for browser-preset ([#516](https://github.com/nitrojs/nitropack/issues/516)) ([69fd546](https://github.com/nitrojs/nitropack/commit/69fd546b63f10becd706d24b917e01e1b60aaa00))
- **nitro:** don't externalize [@nuxt](https://github.com/nuxt), virtual: and # ([e53e297](https://github.com/nitrojs/nitropack/commit/e53e297cee7dc4e3fc62c6fb1f88a28d81505e36))
- **nitro:** emit chunk names without `#` ([#477](https://github.com/nitrojs/nitropack/issues/477)) ([ce9a38e](https://github.com/nitrojs/nitropack/commit/ce9a38e23903802b7c29bec9215c899a3e44b379))
- **nitro:** ensure that nitro runtime is not externalized ([#121](https://github.com/nitrojs/nitropack/issues/121)) ([d78237d](https://github.com/nitrojs/nitropack/commit/d78237db1bd7b662a687884eb1cc8c0c934cfb6a))
- **nitro:** exclude `rootDir` from externals and reinstate automock warning ([#66](https://github.com/nitrojs/nitropack/issues/66)) ([5d9344f](https://github.com/nitrojs/nitropack/commit/5d9344fc529995d5de0a4b9f24d2f12f2cab6c79))
- **nitro:** export named function rather than default export ([#490](https://github.com/nitrojs/nitropack/issues/490)) ([3ade210](https://github.com/nitrojs/nitropack/commit/3ade21091684a1306800f19871854b7e78932f77))
- **nitro:** filter alias in `/_vfs` listing ([#1296](https://github.com/nitrojs/nitropack/issues/1296)) ([39b6db8](https://github.com/nitrojs/nitropack/commit/39b6db8ee1692ac2a163a144d0c9c523974c42d4))
- **nitro:** filter out duplicate imports ([#378](https://github.com/nitrojs/nitropack/issues/378)) ([6ce6f68](https://github.com/nitrojs/nitropack/commit/6ce6f6875f70e37143e36100501cb71b70fceb1a))
- **nitro:** firebase package.json is not exported ([#809](https://github.com/nitrojs/nitropack/issues/809)) ([31454ea](https://github.com/nitrojs/nitropack/commit/31454eaac26bf081b206ee23756ff9d070a0d194))
- **nitro:** fix EBUSY error on windows ([#425](https://github.com/nitrojs/nitropack/issues/425)) ([5d79b2f](https://github.com/nitrojs/nitropack/commit/5d79b2f4a7af22a9be48f92357a4406bf9ed5006))
- **nitro:** fix externals regex for scoped packages ([349c1d0](https://github.com/nitrojs/nitropack/commit/349c1d09b057781fccf5d4c67475c1632248500c)), closes [#238](https://github.com/nitrojs/nitropack/issues/238)
- **nitro:** fix regex for tracedFiles scanning ([#1509](https://github.com/nitrojs/nitropack/issues/1509)) ([6054d5b](https://github.com/nitrojs/nitropack/commit/6054d5b1c9663c72d2c7c73375691f0226773783))
- **nitro:** fix rendering with `ssr` disabled ([#2191](https://github.com/nitrojs/nitropack/issues/2191)) ([d32d40d](https://github.com/nitrojs/nitropack/commit/d32d40df11e699f0503ba8dfa3c9fcf04a8ded49))
- **nitro:** fix type inference for `$fetch` ([#938](https://github.com/nitrojs/nitropack/issues/938)) ([d9fdf29](https://github.com/nitrojs/nitropack/commit/d9fdf29ff913a2d2489b157cb1696c4638d6d4f9))
- **nitro:** generate correct netlify entrypoint ([#372](https://github.com/nitrojs/nitropack/issues/372)) ([49a5ebd](https://github.com/nitrojs/nitropack/commit/49a5ebd872c7477b91db3b9d2ae30841e90a790c))
- **nitro:** generate netlify `_redirects` in public ([#298](https://github.com/nitrojs/nitropack/issues/298)) ([2534dc6](https://github.com/nitrojs/nitropack/commit/2534dc6911253581446597a87710108a5672f39f))
- **nitro:** handle esm imports from cjs files ([8decd90](https://github.com/nitrojs/nitropack/commit/8decd9008cad16bba135d72f3fdd96d3244f4b03))
- **nitro:** handle ssr redirects ([#392](https://github.com/nitrojs/nitropack/issues/392)) ([42405c2](https://github.com/nitrojs/nitropack/commit/42405c252d9a50124566d0f15b5f7c40be463f3d))
- **nitro:** handle static assets and api routes for `service-worker` preset ([#518](https://github.com/nitrojs/nitropack/issues/518)) ([9808f05](https://github.com/nitrojs/nitropack/commit/9808f05b510c2613e189d3c82726fa0d8e303eac))
- **nitro:** handle terminating uninitialized worker ([9132a67](https://github.com/nitrojs/nitropack/commit/9132a67131bb8511b0ea8be3ac7a2dd2b134696f))
- **nitro:** import externals as esm namespace ([#394](https://github.com/nitrojs/nitropack/issues/394)) ([1b7f9af](https://github.com/nitrojs/nitropack/commit/1b7f9af123f6fdb0fe773984fd92181bf1de6971))
- **nitro:** import rollup as cjs ([1d9602c](https://github.com/nitrojs/nitropack/commit/1d9602cf00d6b444df0a79774ec5cef05d1f0e6a))
- **nitro:** improve externals error handling ([#1188](https://github.com/nitrojs/nitropack/issues/1188)) ([59ea572](https://github.com/nitrojs/nitropack/commit/59ea5722b5ff57a14fd737b7ef032a512848a496))
- **nitro:** inject entryURL at beginning of entrypoint ([#468](https://github.com/nitrojs/nitropack/issues/468)) ([cb3affa](https://github.com/nitrojs/nitropack/commit/cb3affa4eb96242c6a995632dba72da5f393c8c3))
- **nitro:** inject payload for spa renderer ([#1434](https://github.com/nitrojs/nitropack/issues/1434)) ([09061ca](https://github.com/nitrojs/nitropack/commit/09061ca194935c9effe147d9bf55394a4733dbc2))
- **nitro:** mock consola ([#106](https://github.com/nitrojs/nitropack/issues/106)) ([1679d18](https://github.com/nitrojs/nitropack/commit/1679d18133676e41941854762207cc9814defccb))
- **nitro:** modify contents rather than compiled , remove template `compiled` ([#1154](https://github.com/nitrojs/nitropack/issues/1154)) ([5d7740c](https://github.com/nitrojs/nitropack/commit/5d7740c229ae4e6e3be83971a44d738b165e2f6a))
- **nitro:** narrow replace call for template name ([#1626](https://github.com/nitrojs/nitropack/issues/1626)) ([4e0f597](https://github.com/nitrojs/nitropack/commit/4e0f597aa429b60b5d1a7cbf846637a0ef11907c))
- **nitro:** omit `/index` from generated api urls ([#1371](https://github.com/nitrojs/nitropack/issues/1371)) ([f1a17f2](https://github.com/nitrojs/nitropack/commit/f1a17f28366887761c0909f8c3380c304774d247))
- **nitro:** only serve placeholders for `publicPath` ([1cf0844](https://github.com/nitrojs/nitropack/commit/1cf0844b1d5770a17a84b20bd7fff6e8fe82770e))
- **nitro:** ovrride by user input ([306b96f](https://github.com/nitrojs/nitropack/commit/306b96f82e97d42f0fcf082147a523714d9b478d))
- **nitro:** pass `Headers` to `createFetch` ([#2615](https://github.com/nitrojs/nitropack/issues/2615)) ([87da9c7](https://github.com/nitrojs/nitropack/commit/87da9c7a8d80673e3ff4f879c9212db4dea7225f))
- **nitro:** pass query params to localCall in service worker ([#530](https://github.com/nitrojs/nitropack/issues/530)) ([2af7359](https://github.com/nitrojs/nitropack/commit/2af7359f0bf95c6f6405325a47c99d8914dfa580))
- **nitro:** pass req, res to ssr context (resolves [#39](https://github.com/nitrojs/nitropack/issues/39)) ([0e651d8](https://github.com/nitrojs/nitropack/commit/0e651d8e2c7b471a54b33e0d4f42930f2b263fcf))
- **nitro:** pass sourcemap option through to rollup plugins ([#2387](https://github.com/nitrojs/nitropack/issues/2387)) ([2122f5c](https://github.com/nitrojs/nitropack/commit/2122f5cc7a8ec901a832474db79d0d4848829ab1))
- **nitro:** promisify proxy handler ([#398](https://github.com/nitrojs/nitropack/issues/398)) ([0765495](https://github.com/nitrojs/nitropack/commit/0765495207d48c7d0dea8e5fd98136beef7390d0))
- **nitro:** read body stream on post requests for `service-worker` ([#527](https://github.com/nitrojs/nitropack/issues/527)) ([cf19a6a](https://github.com/nitrojs/nitropack/commit/cf19a6a6bcb0e496493c5cc2643fc559ba1d3319))
- **nitro:** read firebase package.json ([#1108](https://github.com/nitrojs/nitropack/issues/1108)) ([cc66a40](https://github.com/nitrojs/nitropack/commit/cc66a404debfd4dd3176783c438629b5df1bdb5e))
- **nitro:** remove depd unenv alias ([#120](https://github.com/nitrojs/nitropack/issues/120)) ([10083b6](https://github.com/nitrojs/nitropack/commit/10083b6e106dd4952a2780f43d1015063750974c))
- **nitro:** resolve alias for serverMiddleware ([79ef2fb](https://github.com/nitrojs/nitropack/commit/79ef2fb055e6f5f5d4810645b4b968e9cbe14d70))
- **nitro:** resolve default export for assets ([60c1b6b](https://github.com/nitrojs/nitropack/commit/60c1b6ba0a0c759eac917aac56e968639d054c05))
- **nitro:** resolve firebase package versions with `pkg-types` ([#1490](https://github.com/nitrojs/nitropack/issues/1490)) ([971a9dd](https://github.com/nitrojs/nitropack/commit/971a9ddc5584d85a0af346135279d1fe9ca5725e))
- **nitro:** respect fs structure for traced files ([#2107](https://github.com/nitrojs/nitropack/issues/2107)) ([e3faaed](https://github.com/nitrojs/nitropack/commit/e3faaed1e8584b337bd1da43f856aa2e90fc8999))
- **nitro:** revert to main rollup import (closes [#1445](https://github.com/nitrojs/nitropack/issues/1445)) ([5056059](https://github.com/nitrojs/nitropack/commit/505605922756026b95b04d7d4b7e787ee3a2b57d))
- **nitro:** set `makeAbsoluteExternalsRelative` to false (resolves [#160](https://github.com/nitrojs/nitropack/issues/160)) ([df28558](https://github.com/nitrojs/nitropack/commit/df285585a145733fc8a7a67e14691b91b993de95))
- **nitro:** set content-type header before html 404 ([#2301](https://github.com/nitrojs/nitropack/issues/2301)) ([68ab584](https://github.com/nitrojs/nitropack/commit/68ab584b7a089e425014fd692b7156e42622f11b))
- **nitro:** set esbuild `target: '2019'` ([#189](https://github.com/nitrojs/nitropack/issues/189)) ([7d8505c](https://github.com/nitrojs/nitropack/commit/7d8505c59dde1a4a8dbea40bd3d8bdfedaa7de36))
- **nitro:** show all ERR_MODULE_NOT_FOUND errors ([#561](https://github.com/nitrojs/nitropack/issues/561)) ([1a98e26](https://github.com/nitrojs/nitropack/commit/1a98e262f6732b3361615f7639cad370ecae76da))
- **nitro:** skip copying symlinks and directories ([#1510](https://github.com/nitrojs/nitropack/issues/1510)) ([5a0d1a1](https://github.com/nitrojs/nitropack/commit/5a0d1a1f0ff140313b94134b85a7a32da198ae9d))
- **nitro:** skip non existing externals ([#1876](https://github.com/nitrojs/nitropack/issues/1876)) ([bae42e9](https://github.com/nitrojs/nitropack/commit/bae42e9f691ca6560de5a3a588b3101fb99394eb))
- **nitro:** sort middleware from long to short ([340bc61](https://github.com/nitrojs/nitropack/commit/340bc61fda9cec163e269901170b89b86a2d55b5))
- **nitro:** support ~/@ aliases and explicitly externalize buildDir ([242207a](https://github.com/nitrojs/nitropack/commit/242207ab7e32bd3bcad4566f816fc40f01349d02))
- **nitro:** support built `publicPath` ([#1479](https://github.com/nitrojs/nitropack/issues/1479)) ([8934c04](https://github.com/nitrojs/nitropack/commit/8934c0477299ea7c098c78b3babd8c05027f2b89))
- **nitro:** support vue-meta (compat) ([f0cd329](https://github.com/nitrojs/nitropack/commit/f0cd32997ecf5acbb95dbeefdc41e922ada080f7))
- **nitro:** terminate active worker before replacing ([#1302](https://github.com/nitrojs/nitropack/issues/1302)) ([1b93a42](https://github.com/nitrojs/nitropack/commit/1b93a42c81ec05497244aa9b6fa9b00a989612b0))
- **nitro:** type inference for api routes returning promise ([#1483](https://github.com/nitrojs/nitropack/issues/1483)) ([3f5bba1](https://github.com/nitrojs/nitropack/commit/3f5bba15f6d7430493b98f1fb3a0faaa18254a9e))
- **nitro:** update azure swa implementation ([#1069](https://github.com/nitrojs/nitropack/issues/1069)) ([5194af6](https://github.com/nitrojs/nitropack/commit/5194af646b53dbff93b360f60c9b3cbf0ff305e5))
- **nitro:** update dot-prop import ([81f51d5](https://github.com/nitrojs/nitropack/commit/81f51d5fc2df92504fbe0d4f0a8a85720efdae5c))
- **nitro:** update firebase preset to handle mjs output ([#1360](https://github.com/nitrojs/nitropack/issues/1360)) ([7797383](https://github.com/nitrojs/nitropack/commit/77973834388c87809f1075000373ad9c5571e775))
- **nitro:** update nitro internal hook name ([#218](https://github.com/nitrojs/nitropack/issues/218)) ([f99d5a2](https://github.com/nitrojs/nitropack/commit/f99d5a25b9b48365ff1928bc184394c267bc5f48))
- **nitro:** upgrade table dependency ([3e43fd7](https://github.com/nitrojs/nitropack/commit/3e43fd78e75bc5e103231606df18c44a649e6bb0)), closes [#2250](https://github.com/nitrojs/nitropack/issues/2250)
- **nitro:** use `app.assetsPath` for `publicPath` ([#1978](https://github.com/nitrojs/nitropack/issues/1978)) ([699e763](https://github.com/nitrojs/nitropack/commit/699e7638842fb8bf451bba06327ce8364eb130bd))
- **nitro:** use `generate:page` hook for browser to inject sw ([134431b](https://github.com/nitrojs/nitropack/commit/134431b3db9b9c7577a33a9c023275caae53c7ba)), closes [#522](https://github.com/nitrojs/nitropack/issues/522)
- **nitro:** use file url for `#build` alias in windows dev ([#469](https://github.com/nitrojs/nitropack/issues/469)) ([d4a9f23](https://github.com/nitrojs/nitropack/commit/d4a9f233a888808bed3a582261b90a2c0f45a985))
- **nitro:** use globalThis ([5a0d9e7](https://github.com/nitrojs/nitropack/commit/5a0d9e7303cfea8e3ffa6fd7abd05bde3f809b00))
- **nitro:** use nuxt2 compatible template ([#268](https://github.com/nitrojs/nitropack/issues/268)) ([48e2dfa](https://github.com/nitrojs/nitropack/commit/48e2dfa346f5fd790c4f31f6ec27d80d39a4067a)), closes [#265](https://github.com/nitrojs/nitropack/issues/265)
- **nitro:** use random port for stackblitz ([#1666](https://github.com/nitrojs/nitropack/issues/1666)) ([d5bb79c](https://github.com/nitrojs/nitropack/commit/d5bb79c48c7a23d8061fc4279eb02f4c6e47f718))
- **nitro:** use unenv 0.3.x (closes [#266](https://github.com/nitrojs/nitropack/issues/266)) ([6ac6aeb](https://github.com/nitrojs/nitropack/commit/6ac6aeb94a66427ddc958832793cb0c4d039a4f7))
- **nitro:** used named export for azure entry ([#491](https://github.com/nitrojs/nitropack/issues/491)) ([903ab87](https://github.com/nitrojs/nitropack/commit/903ab872bfc509d90d518c8aa1ba59ad19dc7f85))
- **nitro:** watch .mjs and .cjs extensions (closes [#352](https://github.com/nitrojs/nitropack/issues/352)) ([cab8faa](https://github.com/nitrojs/nitropack/commit/cab8faa866b14b5d1b8f8a65a6306ecf654750b8))
- **nitro:** workaround for vue2 global style injection ([f1b74d0](https://github.com/nitrojs/nitropack/commit/f1b74d093421e42322195cd5a6e58ba544c59794))
- **nuxi:** update version and vite detection ([#1169](https://github.com/nitrojs/nitropack/issues/1169)) ([db69571](https://github.com/nitrojs/nitropack/commit/db695717b49ac8c3d481ad9e22b7bd01cd440760))
- **nuxt3:** provide `NuxtWelcome` component from design ([#745](https://github.com/nitrojs/nitropack/issues/745)) ([2d13716](https://github.com/nitrojs/nitropack/commit/2d137168b6a621ea403af116996dfd553b007882))
- only generate .sls directory when needed ([de51381](https://github.com/nitrojs/nitropack/commit/de513815b597c08009a7a22e064046e1a4195567))
- pass Headers to createFetch ([#7](https://github.com/nitrojs/nitropack/issues/7)) ([0b55f3c](https://github.com/nitrojs/nitropack/commit/0b55f3cdc22d3e8fa3996d1d6f5f15dddadb9e54))
- **pkg:** downgrade node version to 14.16.x due to stackblitz issue ([18d2a90](https://github.com/nitrojs/nitropack/commit/18d2a907aa9b21135767841e39ac83e096058720))
- **pkg:** downgrade node version to 14.17.x due to codesandbox issue ([f00f9d4](https://github.com/nitrojs/nitropack/commit/f00f9d4d5d22c93529ca721b9093e35ea04bcc69))
- **pkg:** expose `defineNitroPreset` ([4846247](https://github.com/nitrojs/nitropack/commit/48462472ea27b00f66528946dcffbec60b0851bc))
- **pkg:** remove vue3 from peerDependencies ([#1382](https://github.com/nitrojs/nitropack/issues/1382)) ([814ac73](https://github.com/nitrojs/nitropack/commit/814ac7377a2321aa039bb714b4cf3ce0e8f0f253))
- **pkg:** support node 17.x in the engines field ([#1443](https://github.com/nitrojs/nitropack/issues/1443)) ([3416d8c](https://github.com/nitrojs/nitropack/commit/3416d8c7be8eb6f70e94fce319f2309a3dcbc90a))
- preset types ([5574f7e](https://github.com/nitrojs/nitropack/commit/5574f7e2216ef16c0ffa7f91821d2e7f5f6891f1))
- promisify: false support ([768081b](https://github.com/nitrojs/nitropack/commit/768081bca2443530fa890ad91724649d3452f07d))
- properly resolve runtimeDir from chunks ([9adfacd](https://github.com/nitrojs/nitropack/commit/9adfacd860cbecfd4eb0d101b9f5072a9f01e50c))
- remove extra `console.log` ([82c2767](https://github.com/nitrojs/nitropack/commit/82c27673951248c7e1527b8c7f683357c3a8d8f4))
- remove runtime/ prefix ([0be4ba1](https://github.com/nitrojs/nitropack/commit/0be4ba18acd1359775ae1c741812c336766759c1))
- remove windows workaround for now ([4af4f32](https://github.com/nitrojs/nitropack/commit/4af4f32e386ea5d55bb84306bfd7f5393dce48d2))
- rename cold start -> nitro start ([#12](https://github.com/nitrojs/nitropack/issues/12)) ([bba998b](https://github.com/nitrojs/nitropack/commit/bba998b4364a2d04527c7ccfc364143d7b09d115))
- **render:** don't override statusCode ([f166cfa](https://github.com/nitrojs/nitropack/commit/f166cfa612ec13eccd19a9f044781e77ef1ddc9f))
- resolve chunksDirName based on outNames dirname (vercel) ([e82cfcc](https://github.com/nitrojs/nitropack/commit/e82cfcc5004f542ebf29897ea245262994b53e29))
- resolve runtime provided dependencies ([3e9e27e](https://github.com/nitrojs/nitropack/commit/3e9e27efb67e4c13d27b4ff1fc5dcffa399959db))
- **resolveMiddleware:** remove legacy handler and path props ([1de3717](https://github.com/nitrojs/nitropack/commit/1de3717b2c778ea7ff2a5e1a3945b0584dc9165f))
- **rollup:** dirnames not generate a sourcemap for the transformation ([#83](https://github.com/nitrojs/nitropack/issues/83)) ([a8c02df](https://github.com/nitrojs/nitropack/commit/a8c02df9ced9e7f4a86742113728d5b8700d8d9b))
- sanitize rollup-generated filenames ([#1648](https://github.com/nitrojs/nitropack/issues/1648)) ([5c49e2a](https://github.com/nitrojs/nitropack/commit/5c49e2aac3a0e325ceb13a7ca21e74574a4cf662))
- **schema:** extend `NuxtOptions` for nitro & bridge types ([#2131](https://github.com/nitrojs/nitropack/issues/2131)) ([4d8e184](https://github.com/nitrojs/nitropack/commit/4d8e184d73cc3b8f31b66bc5be8fb5b3f7ea7b47))
- **schema:** handle null/undefined values in `runtimeConfig` ([#2456](https://github.com/nitrojs/nitropack/issues/2456)) ([7ad2764](https://github.com/nitrojs/nitropack/commit/7ad276479a917fac2e1eeaa08a42d7d727bd66c9))
- serve public assets in production ([2dfad65](https://github.com/nitrojs/nitropack/commit/2dfad65497ea211294a1bcadb10d80eb29ef64e0))
- **service-worker:** check for asset urls ([aab6fbf](https://github.com/nitrojs/nitropack/commit/aab6fbf753da00d06eee1c7d2bfaef881572fd4c))
- silent proxy errors ([63a083c](https://github.com/nitrojs/nitropack/commit/63a083c02bf9b45b5df0ccf838833a6c435790c8))
- skip static dir if not exists ([3b87c28](https://github.com/nitrojs/nitropack/commit/3b87c28d72be042ef9f247daaba678654610b4ff))
- small bug fixes ([26046ee](https://github.com/nitrojs/nitropack/commit/26046ee84ae787bee45a4d3ed4e40557fa074448))
- static asset handling with leading slash ([2303c7d](https://github.com/nitrojs/nitropack/commit/2303c7d6a2dfffa193be2b6e45cc09e488be8b36))
- static dir is in `srcDir` ([#37](https://github.com/nitrojs/nitropack/issues/37)) ([20fe1dc](https://github.com/nitrojs/nitropack/commit/20fe1dcee1cb42a0aac26b5191f5681bc6548814))
- **storage:** replace non-word characters with underscore ([#542](https://github.com/nitrojs/nitropack/issues/542)) ([01628ae](https://github.com/nitrojs/nitropack/commit/01628ae48bfaa75380b44c433f6ce5846a4df8c6))
- support both targets by adding prepare step ([36bfc43](https://github.com/nitrojs/nitropack/commit/36bfc43db294dfa4985aa89c6211d89184e78861))
- temporary disable auto mock plugin ([414dfb6](https://github.com/nitrojs/nitropack/commit/414dfb6acf6f4abb09d4ad22d57dd7776455ee15))
- temporary remove dev warning for pwa module ([#40](https://github.com/nitrojs/nitropack/issues/40)) ([e1cf8a0](https://github.com/nitrojs/nitropack/commit/e1cf8a06c3fe01036f2e70386932eb0651704936))
- timing plugin helper import ([d9b28da](https://github.com/nitrojs/nitropack/commit/d9b28da5291def39419b044cb956b804c9ba53b6)), closes [nuxt/framework#3399](https://github.com/nuxt/framework/issues/3399)
- **timing:** include helpers only in entries ([fe5a33e](https://github.com/nitrojs/nitropack/commit/fe5a33e1605464da63edf5d45d944cbe795aec71))
- update `service-worker` preset ([ce3aaf6](https://github.com/nitrojs/nitropack/commit/ce3aaf6d7caab4f8797a5e435372719ecbe82dc9))
- update changed mw.path => route ([359a959](https://github.com/nitrojs/nitropack/commit/359a959725719f65f3e9978052be9ea4b9cdaa93))
- update documentPath with updated buildDir ([#70](https://github.com/nitrojs/nitropack/issues/70)) ([25fa3eb](https://github.com/nitrojs/nitropack/commit/25fa3ebb3eb8b8a54b9a12cd621353949e749d54))
- update h3 for static asset handling ([2861c61](https://github.com/nitrojs/nitropack/commit/2861c61f333d07fd5028425c9366f228089b2e66))
- update node-resolve options ([e33b658](https://github.com/nitrojs/nitropack/commit/e33b6582b38e4d1adcd1be4e5fccccb09a5d9a0b))
- update runtime/config ([b979f74](https://github.com/nitrojs/nitropack/commit/b979f748878d89b9452555561451d7d2bf701b5d))
- update service-worker entry ([5874d01](https://github.com/nitrojs/nitropack/commit/5874d01c830086862ed557d43bebd0c10c3378d1))
- use `globalThis` instead of `global` ([#59](https://github.com/nitrojs/nitropack/issues/59)) ([fb56216](https://github.com/nitrojs/nitropack/commit/fb56216d3e8c193f561ad4345ce436a5cb9f34c9))
- use `perfect-debounce` ([#22](https://github.com/nitrojs/nitropack/issues/22)) ([5642e0d](https://github.com/nitrojs/nitropack/commit/5642e0d8660934c1665bc02b7acf89e9588f66a1))
- use allowlist approach to chunk name ([#101](https://github.com/nitrojs/nitropack/issues/101)) ([42f2269](https://github.com/nitrojs/nitropack/commit/42f226966265473cce5452f6a79ed42d3479825b)), closes [#93](https://github.com/nitrojs/nitropack/issues/93)
- use connect for dev server due to loading-screen issue ([67d78c8](https://github.com/nitrojs/nitropack/commit/67d78c87a5acbba483aa034fee3e2d296b179e09))
- use devalue to handle runtime config ([#28](https://github.com/nitrojs/nitropack/issues/28)) ([2522178](https://github.com/nitrojs/nitropack/commit/2522178f9ced253337fc8545212e666aa7f455ea))
- use dist for netlify as default ([d4d5285](https://github.com/nitrojs/nitropack/commit/d4d52859792168dea2796d96e2638f7db44941f9))
- use globalThis for client plugin ([34dbae8](https://github.com/nitrojs/nitropack/commit/34dbae8391071819117852356ffb7ee6388b60c9))
- use html.contents ([97d0ebe](https://github.com/nitrojs/nitropack/commit/97d0ebe1e75b4a4864681c38f59c1f0cb0a6d840))
- use native fetch when node is disabled ([4271c65](https://github.com/nitrojs/nitropack/commit/4271c6522cca80e9c067be26e025fec4f570113a))
- use nitro plugin with explicit mjs extension ([78135ac](https://github.com/nitrojs/nitropack/commit/78135acc4336e38f3d07f66a33f62f5a06a702ba))
- use output/public for prerenderer ([70c0866](https://github.com/nitrojs/nitropack/commit/70c086650b3f1e14562c6f0814f55e5001a96113))
- use same global to inject process.hrtime ([0303912](https://github.com/nitrojs/nitropack/commit/030391290e1a9c9c6338a06883f14a1d3362d213))
- use types dir for now ([#29](https://github.com/nitrojs/nitropack/issues/29)) ([2f27572](https://github.com/nitrojs/nitropack/commit/2f2757228e0a55bffb96fa22d00ffefe2dc1a60c))
- **vercel:** add `/index` suffix to dst ([601b413](https://github.com/nitrojs/nitropack/commit/601b41312ce8fe2d82b53c8f0a9ba400aea3eea9))
- **vercel:** add api prefix ([1fc0d9a](https://github.com/nitrojs/nitropack/commit/1fc0d9a55e95278a698305b99953050b0ceedc58))
- **vercel:** add missing node segment ([b68b4c9](https://github.com/nitrojs/nitropack/commit/b68b4c931ba8fc73a5bc1e80debbe03a46a42586))
- **vercel:** entry should export handle as default ([c8b1346](https://github.com/nitrojs/nitropack/commit/c8b13463b8ef7b8e41648b45b0fc28a05673e48a))
- **vercel:** generate to config/routes.json ([f9e35f6](https://github.com/nitrojs/nitropack/commit/f9e35f686b7b37256bb2f41132f7ae6f27eba97d))
- **vercel:** remove index.js from serverDir ([9ba1281](https://github.com/nitrojs/nitropack/commit/9ba1281d573f7965b4de48d9c86327dc3aa4325f))
- **vite:** don't copy `publicDir` files to `_nuxt` ([#2135](https://github.com/nitrojs/nitropack/issues/2135)) ([98f86e3](https://github.com/nitrojs/nitropack/commit/98f86e344f90ea45bfe292c418641dc931930543))
- **webpack:** use cjs for emitted webpack files ([#395](https://github.com/nitrojs/nitropack/issues/395)) ([aed8092](https://github.com/nitrojs/nitropack/commit/aed8092777feb85a406756b79f50407b4e6b21de))
- windows path issues ([#408](https://github.com/nitrojs/nitropack/issues/408)) ([4f118b6](https://github.com/nitrojs/nitropack/commit/4f118b62511d16287893b14bd4fbc5fd4e3f8db7))
- workaround for `vue` 3.2.18+ esm bundle issue and revert [#566](https://github.com/nitrojs/nitropack/issues/566) ([#578](https://github.com/nitrojs/nitropack/issues/578)) ([#578](https://github.com/nitrojs/nitropack/issues/578)) ([e60d22a](https://github.com/nitrojs/nitropack/commit/e60d22aa75a3dbde75a773fae6f037baa783f474))
- **worker:** smaller and working hrtime polyfill ([2f60ea4](https://github.com/nitrojs/nitropack/commit/2f60ea4ec49b7acd5929eef4caf6e30ac4a6e1ad))
- **worker:** wrap polyfill to iife ([3049212](https://github.com/nitrojs/nitropack/commit/3049212de55a296828b40d6670f6a512fe8c7271))

- expose `nitroApp` to entries ([4aa955f](https://github.com/nitrojs/nitropack/commit/4aa955f44d06d99c2790046f4b8f5d3ffc5ed6b6))
- simplify storage options ([cffb900](https://github.com/nitrojs/nitropack/commit/cffb90089834b65acbe8b8957a3b6a7631318d62))
- use `app.baseURL` runtime config for framework agnostic usage ([59196a6](https://github.com/nitrojs/nitropack/commit/59196a65266c227ce7a4cb6fa005eebe8cbfdaae))
