import type { PresetEnv } from "./env.ts";

// Node.js modules with an `unenv/node/<name>` polyfill
// prettier-ignore
const unenvNodeModules = [
  "assert", "assert/strict", "async_hooks", "buffer", "child_process", "cluster", "console",
  "constants", "crypto", "dgram", "diagnostics_channel", "dns", "dns/promises", "domain", "events",
  "fs", "fs/promises", "http", "http2", "https", "inspector", "inspector/promises", "module", "net",
  "os", "path", "perf_hooks", "process", "punycode", "querystring", "readline",
  "readline/promises", "repl", "stream", "stream/consumers", "stream/promises", "stream/web",
  "string_decoder", "timers", "timers/promises", "tls", "trace_events", "tty", "url", "util",
  "util/types", "v8", "vm", "wasi", "worker_threads", "zlib",
];

// Node.js internal modules, mocked by `unenv/mock/proxy-cjs`
// prettier-ignore
const unenvMockedModules = [
  "_http_agent", "_http_client", "_http_common", "_http_incoming", "_http_outgoing",
  "_http_server", "_stream_duplex", "_stream_passthrough", "_stream_readable",
  "_stream_transform", "_stream_wrap", "_stream_writable", "_tls_common", "_tls_wrap",
];

const unenvNodeAliases: Record<string, string> = {
  ...Object.fromEntries(unenvNodeModules.map((m) => [m, `unenv/node/${m}`])),
  ...Object.fromEntries(unenvMockedModules.map((m) => [m, "unenv/mock/proxy-cjs"])),
  "path/posix": "unenv/node/path",
  "path/win32": "unenv/node/path",
  sys: "unenv/node/util",
};

/**
 * Node.js compatibility layer for `node: false` builds.
 *
 * Node.js modules are aliased to `unenv` polyfills, which are only resolved
 * (and `unenv` installed) once a build actually imports one of them.
 */
export const nodeCompatEnv: PresetEnv = {
  alias: {
    ...unenvNodeAliases,
    ...Object.fromEntries(Object.entries(unenvNodeAliases).map(([m, to]) => [`node:${m}`, to])),
    "node:sqlite": "unenv/node/sqlite",
  },
  inject: {
    global: "#nitro/runtime/polyfills/globalthis",
    process: "node:process",
    Buffer: ["node:buffer", "Buffer"],
    clearImmediate: ["node:timers", "clearImmediate"],
    setImmediate: ["node:timers", "setImmediate"],
    performance: "unenv/polyfill/performance",
    PerformanceObserver: ["node:perf_hooks", "PerformanceObserver"],
    BroadcastChannel: ["node:worker_threads", "BroadcastChannel"],
  },
  polyfills: [
    "#nitro/runtime/polyfills/global",
    "#nitro/runtime/polyfills/process",
    "#nitro/runtime/polyfills/buffer",
    "#nitro/runtime/polyfills/timers",
  ],
};
