// Rspack pre-loader of the `rspack` builder (runs on the host, see `build/rspack/_plugin.ts`)
export default function nitroLoader(code, map) {
  const callback = this.async();
  const host = this.getOptions().host;
  if (!host) {
    return callback(new Error("[nitro] Rspack loader used outside of a Nitro build."));
  }
  host
    .runLoader(this, code, map)
    .then((result) => callback(null, result.code, result.map), callback);
}
