import "#nitro/virtual/polyfills";
import { useNitroApp } from "nitro/app";

const nitroApp = useNitroApp();

// @ts-expect-error
if (typeof Bunny !== "undefined") {
  // @ts-expect-error
  Bunny.v1.serve(nitroApp.fetch);
} else {
  const _parsedPort = Number.parseInt(process.env.NITRO_PORT ?? process.env.PORT ?? "");

  Deno.serve(
    {
      port: Number.isNaN(_parsedPort) ? 3000 : _parsedPort,
      hostname: process.env.NITRO_HOST || process.env.HOST,
    },
    nitroApp.fetch
  );
}
