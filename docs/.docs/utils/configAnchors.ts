// Anchors of the former single-page config reference (`/config#<anchor>`),
// grouped by the page they moved to. Only needed for old links: do not add new options.
export const legacyConfigAnchors: Record<string, string[]> = {
  general: ['preset', 'defaultpreset', 'debug', 'loglevel', 'logging', 'runtimeconfig', 'compatibilitydate', 'static'],
  features: ['features', 'experimental', 'openapi', 'renderer', 'ssrroutes', 'modules', 'plugins', 'tasks', 'scheduledtasks', 'virtual', 'wasm', 'runtimehooks', 'websocket', 'fastresponse', 'typescriptbundlerresolution', 'asynccontext', 'sourcemapminify', 'envexpansion', 'tracinglogger'],
  storage: ['kv', 'cache', 'database', 'devdatabase'],
  assets: ['servestatic', 'nopublicdir', 'publicassets', 'compresspublicassets', 'serverassets'],
  routing: ['baseurl', 'apibaseurl', 'serverentry', 'handlers', 'devhandlers', 'routes', 'errorhandler', 'routerules', 'prerender'],
  directories: ['workspacedir', 'rootdir', 'serverdir', 'scandirs', 'apidir', 'routesdir', 'builddir', 'output', 'ignore', 'scansuffixes'],
  dev: ['devserver', 'watchoptions', 'devproxy'],
  build: ['builder', 'buildplugins', 'rollupconfig', 'rolldownconfig', 'vite', 'deps', 'entry', 'alias', 'inject', 'polyfills', 'builtinmodules', 'minify', 'inlinedynamicimports', 'sourcemap', 'node', 'replace', 'commonjs', 'exportconditions', 'noexternals', 'tracedeps', 'traceopts', 'oxc', 'inlining-specific-packages'],
  advanced: ['dev', 'typescript', 'hooks', 'commands', 'deverrorhandler', 'tracingchannel', 'framework', 'manifest'],
  presets: ['awsamplify', 'awslambda', 'azure', 'firebase', 'iis', 'netlify', 'vercel', 'cloudflare', 'zephyr'],
}

// Former section anchors
export const legacyConfigSections: Record<string, string> = {
  'general': '/config/general',
  'logging': '/config/general#logging',
  'features': '/config/features',
  'routing': '/config/routing',
  'directories': '/config/directories',
  'dev': '/config/dev',
  'build': '/config/build',
  'advanced': '/config/advanced',
  'preset-options': '/config/presets',
}
