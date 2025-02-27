// https://github.com/cloudflare/workerd/blob/main/src/node/module.ts

import workerdModule from "#workerd/node:module";

import { notImplemented } from "unenv/_internal/utils";

import {
  constants,
  enableCompileCache,
  findSourceMap,
  getCompileCacheDir,
  globalPaths,
  Module,
  register,
  runMain,
  SourceMap,
  syncBuiltinESMExports,
  wrap,
  flushCompileCache,
  stripTypeScriptTypes,
  wrapper,
  _readPackage,
  _stat,
  _cache,
  _debug,
  _extensions,
  _findPath,
  _initPaths,
  _load,
  _nodeModulePaths,
  _pathCache,
  _preloadModules,
  _resolveFilename,
  _resolveLookupPaths,
} from "unenv/node/module";

export {
  Module,
  SourceMap,
  constants,
  enableCompileCache,
  findSourceMap,
  getCompileCacheDir,
  globalPaths,
  register,
  runMain,
  syncBuiltinESMExports,
  wrap,
  flushCompileCache,
  stripTypeScriptTypes,
  wrapper,
  _cache,
  _extensions,
  _debug,
  _pathCache,
  _findPath,
  _initPaths,
  _load,
  _nodeModulePaths,
  _preloadModules,
  _resolveFilename,
  _resolveLookupPaths,
  _readPackage,
  _stat,
} from "unenv/node/module";

export const { builtinModules, isBuiltin } = workerdModule;

export const createRequire = (file) => {
  return Object.assign(workerdModule.createRequire(file), {
    resolve: Object.assign(notImplemented("module.require.resolve"), {
      paths: notImplemented("module.require.resolve.paths"),
    }),
    cache: Object.create(null),
    extensions: _extensions,
    main: undefined,
  });
};

export default {
  Module,
  SourceMap,
  builtinModules,
  enableCompileCache,
  constants,
  createRequire,
  findSourceMap,
  getCompileCacheDir,
  globalPaths,
  isBuiltin,
  register,
  runMain,
  syncBuiltinESMExports,
  wrap,
  flushCompileCache,
  stripTypeScriptTypes,
  wrapper,
  _cache,
  _extensions,
  _debug,
  _pathCache,
  _findPath,
  _initPaths,
  _load,
  _nodeModulePaths,
  _preloadModules,
  _resolveFilename,
  _resolveLookupPaths,
};
