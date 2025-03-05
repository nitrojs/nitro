import { genImport } from "knitwork";
import type { Nitro } from "nitro/types";
import { virtual } from "./virtual";

export function appConfig(nitro: Nitro) {
  return virtual(
    {
      "#nitro-internal-virtual/app-config": () => `
import { defuFn } from 'defu';

const inlineAppConfig = ${JSON.stringify(nitro.options.appConfig, null, 2)};

${nitro.options.appConfigFiles
  .map((file, i) => genImport(file, "appConfig" + i) + ";")
  .join("\n")}

export const appConfig = defuFn(${[
        ...nitro.options.appConfigFiles.map((_, i) => "appConfig" + i),
        "inlineAppConfig",
      ].join(", ")});
      `,
    },
    nitro.vfs
  );
}
