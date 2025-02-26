// Auto generated using gen-node-compat.ts on 2025-02-26T20:49:20.846Z
// Source: https://platform-node-compat.vercel.app/
// Do not edit this file manually

// prettier-ignore
export const builtnNodeModules = [
  "_stream_duplex",
  "_stream_passthrough",
  "_stream_readable",
  "_stream_transform",
  "_stream_writable",
  "assert", // Missing exports: CallTracker, partialDeepStrictEqual
  "assert/strict", // Missing exports: CallTracker, partialDeepStrictEqual
  "async_hooks",
  "buffer",
  "diagnostics_channel",
  "dns",
  "dns/promises",
  "events", // Missing exports: captureRejections, init
  "net", // Missing exports: Stream
  "path",
  "path/posix",
  "path/win32",
  "querystring",
  "stream", // Missing exports: duplexPair
  "stream/consumers",
  "stream/promises",
  "stream/web",
  "string_decoder",
  "timers",
  "timers/promises",
  "url",
  "util/types",
  "zlib",
];

// prettier-ignore
export const hybridNodeModules = [
  "crypto", // Missing exports: Cipher, Cipheriv, Decipher, Decipheriv, ECDH, Sign, Verify, constants, createCipheriv, createDecipheriv, createECDH, createSign, createVerify, getCipherInfo, hash, privateDecrypt, privateEncrypt, publicDecrypt, publicEncrypt, sign, verify
  "module", // Missing exports: Module, SourceMap, constants, enableCompileCache, findPackageJSON, findSourceMap, flushCompileCache, getCompileCacheDir, getSourceMapsSupport, globalPaths, register, runMain, setSourceMapsSupport, stripTypeScriptTypes, syncBuiltinESMExports
  "process", // Missing exports: abort, allowedNodeEnvironmentFlags, arch, argv, argv0, assert, availableMemory, binding, chdir, config, constrainedMemory, cpuUsage, cwd, debugPort, dlopen, domain, emitWarning, execArgv, execPath, exitCode, features, finalization, getActiveResourcesInfo, getegid, geteuid, getgid, getgroups, getuid, hasUncaughtExceptionCaptureCallback, hrtime, initgroups, kill, loadEnvFile, memoryUsage, moduleLoadList, openStdin, pid, ppid, reallyExit, ref, release, report, resourceUsage, setSourceMapsEnabled, setUncaughtExceptionCaptureCallback, setegid, seteuid, setgid, setgroups, setuid, sourceMapsEnabled, stderr, stdin, stdout, title, umask, unref, uptime, version, versions
  "util", // Missing exports: isBoolean, isBuffer, isDate, isError, isFunction, isNull, isNullOrUndefined, isNumber, isObject, isPrimitive, isRegExp, isString, isSymbol, isUndefined
];

// prettier-ignore
export const unsupportedNodeModules = [
  "_http_agent",
  "_http_client",
  "_http_common",
  "_http_incoming",
  "_http_outgoing",
  "_http_server",
  "_stream_wrap",
  "_tls_common",
  "_tls_wrap",
  "child_process",
  "cluster",
  "console",
  "constants",
  "dgram",
  "domain",
  "fs",
  "fs/promises",
  "http",
  "http2",
  "https",
  "inspector",
  "inspector/promises",
  "os",
  "perf_hooks",
  "punycode",
  "readline",
  "readline/promises",
  "repl",
  "sys",
  "tls",
  "trace_events",
  "tty",
  "v8",
  "vm",
  "wasi",
  "worker_threads",
];
