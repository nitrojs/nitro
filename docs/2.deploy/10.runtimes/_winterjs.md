---
icon: game-icons:cold-heart
---

# WinterJS

**Preset:** `winterjs`

You can easily build Nitro powered applications to run with [wasmerio/winterjs](https://github.com/wasmerio/winterjs) runtime.

[WinterJS](https://github.com/wasmerio/winterjs) is a JavaScript Service Workers server written in Rust, that uses the SpiderMonkey runtime to execute JavaScript (the same runtime that Firefox uses) ([announcement](https://wasmer.io/posts/announcing-winterjs-service-workers)).


::warning
🚧 WinterJS runtime is unstable and under heavy development. Follow [nitrojs/nitro#1861](https://github.com/nitrojs/nitro/issues/1861) for status and information.
::


In order to build for this runtime, use `NITRO_PRESET="winterjs"` environment variable:

```sh
NITRO_PRESET="winterjs" npm run build
```

Make sure you have `wasmer` installed locally ([install wasmer](https://docs.wasmer.io/install))

Run locally:

```sh
wasmer run wasmer/winterjs --forward-host-env --net --mapdir app:.output app/server/index.mjs
```
