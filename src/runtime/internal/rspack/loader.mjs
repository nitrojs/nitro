// Rspack pre-loader of the `rspack` builder (runs on the host, see `build/rspack/_plugin.ts`)
const HOST_KEY = Symbol.for("nitro:rspack-host");

export default function nitroLoader(code, map) {
  const callback = this.async();
  let compiler = this._compiler;
  while (compiler && !compiler[HOST_KEY]) {
    compiler = compiler.parentCompilation?.compiler;
  }
  const host = compiler?.[HOST_KEY];
  if (!host) {
    return callback(new Error("[nitro] Rspack loader used outside of a Nitro build."));
  }
  host
    .runLoader(this, code, map)
    .then((result) => callback(null, result.code, result.map), callback);
}
