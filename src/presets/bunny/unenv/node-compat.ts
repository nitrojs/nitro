// Bunny Edge Scripting runs on Deno but exposes a smaller allow-list of
// Node.js built-ins than Deno itself. Importing anything outside this list
// fails to load with `Unknown: disallowed module reference`.
//
// Verified on 2026-09-13 by importing every Node.js built-in from a deployed
// Edge Script. Not importable: child_process, cluster, constants, dgram,
// inspector, inspector/promises, path/win32, repl, sqlite, sys, trace_events,
// tty, v8, vm, wasi, worker_threads.
//
// Importable does not mean functional: Bunny documents that supported modules
// may be partially stubbed. This list only decides what may stay an import.

// prettier-ignore
export const builtinNodeModules = [
  "node:assert",
  "node:assert/strict",
  "node:async_hooks",
  "node:buffer",
  "node:console",
  "node:crypto",
  "node:diagnostics_channel",
  "node:dns",
  "node:dns/promises",
  "node:domain",
  "node:events",
  "node:fs",
  "node:fs/promises",
  "node:http",
  "node:http2",
  "node:https",
  "node:module",
  "node:net",
  "node:os",
  "node:path",
  "node:path/posix",
  "node:perf_hooks",
  "node:process",
  "node:punycode",
  "node:querystring",
  "node:readline",
  "node:readline/promises",
  "node:stream",
  "node:stream/consumers",
  "node:stream/promises",
  "node:stream/web",
  "node:string_decoder",
  "node:timers",
  "node:timers/promises",
  "node:tls",
  "node:url",
  "node:util",
  "node:util/types",
  "node:zlib",
];
