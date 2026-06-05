import type { Nitro } from "nitro/types";

export default function tracing(nitro: Nitro) {
  return {
    id: "#nitro/virtual/tracing",
    template: () => {
      const { srvx, h3 } = nitro.options.tracingChannel || {};
      const imports: string[] = [];
      const setup: string[] = [];

      if (srvx) {
        imports.push(`import { tracingPlugin as srvxTracing } from "srvx/tracing";`);
      }
      if (h3) {
        imports.push(`import { tracingPlugin as h3Tracing } from "h3/tracing";`);
        setup.push(`  h3Tracing()(nitroApp.h3);`);
      }

      return [
        ...imports,
        `export const tracingSrvxPlugins = [${srvx ? "srvxTracing()" : ""}];`,
        `export default function tracing(nitroApp) {`,
        ...setup,
        `};`,
      ].join("\n");
    },
  };
}
