import type { Nitro } from "nitro/types";

export default function tracing(nitro: Nitro) {
  return {
    id: "#nitro/virtual/tracing",
    template: () => {
      return /* js */ `
        import { tracingPlugin as h3Tracing } from "h3/tracing";
        import { tracingPlugin as srvxTracing } from 'srvx/tracing'

        export const tracingSrvxPlugins = ${nitro.options.tracing!.srvx ? "[srvxTracing()]" : "[]"};

        export default function tracing(nitroApp) {
          h3Tracing()(nitroApp.h3);
        };
      `;
    },
  };
}
