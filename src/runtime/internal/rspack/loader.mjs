// Rspack pre-loader of the `rspack` builder (runs on the host, see `build/rspack/_plugin.ts`)
export default function nitroLoader(code) {
  const callback = this.async();
  const host = globalThis.__nitro_rspack_hosts__?.get(this.getOptions().host);
  if (!host) {
    return callback(new Error("[nitro] Rspack loader used outside of a Nitro build."));
  }
  host.runLoader(this, code).then((result) => callback(null, result), callback);
}
