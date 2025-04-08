import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitro/runtime";
import { normalize } from "pathe";

const nitroApp = useNitroApp();

async function cli() {
  const url = process.argv[2] || "/";
  const debug = (label: string, ...args: any[]) =>
    console.debug(`> ${label}:`, ...args);
  const r = await nitroApp.localCall({ url });

  debug("URL", url);
  debug("StatusCode", r.status);
  debug("StatusMessage", r.statusText);
  // @ts-ignore
  for (const header of Object.entries(r.headers)) {
    debug(header[0], header[1]);
  }
  console.log("\n", r.body?.toString());
}

if (process.argv.some((arg) => import.meta.url.includes(normalize(arg)))) {
  // eslint-disable-next-line unicorn/prefer-top-level-await
  cli().catch((error) => {
    console.error(error);
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(1);
  });
}
