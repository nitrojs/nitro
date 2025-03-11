import type { Nitro } from "nitro/types";
import { virtual } from "./virtual";
import { runtimeDir } from "nitro/runtime/meta";
import { join } from "pathe";

export function errorHandler(nitro: Nitro) {
  return virtual(
    {
      "#nitro-internal-virtual/error-handler": () => {
        const errorHandlers = Array.isArray(nitro.options.errorHandler)
          ? nitro.options.errorHandler
          : [nitro.options.errorHandler];

        const builtinHandler = join(
          runtimeDir,
          `internal/error/${nitro.options.dev ? "dev" : "prod"}`
        );

        return /* js */ `
${errorHandlers.map((h, i) => `import errorHandler$${i} from "${h}";`).join("\n")}

const errorHandlers = [${errorHandlers.map((_, i) => `errorHandler$${i}`).join(", ")}];

import { defaultHandler } from "${builtinHandler}";

export default async function(error, event) {
  for (const handler of errorHandlers) {
    try {
      await handler(error, event, { defaultHandler });
      if (event.handled) {
        return; // Response handled
      }
    } catch(error) {
      // Handler itself thrown, log and continue
      console.error(error);
    }
  }
  // H3 will handle fallback
}
`;
      },
    },
    nitro.vfs
  );
}
