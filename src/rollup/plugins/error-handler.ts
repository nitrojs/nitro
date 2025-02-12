import type { Nitro } from "nitropack/types";
import { virtual } from "./virtual";

export function errorHandler(nitro: Nitro) {
  return virtual(
    {
      "#nitro-internal-virtual/error-handler": () => {
        const errorHandlers = Array.isArray(nitro.options.errorHandler)
          ? nitro.options.errorHandler
          : [nitro.options.errorHandler];

        return /* js */ `
${errorHandlers.map((h, i) => `import errorHandler$${i} from "${h}";`).join("\n")}

const errorHandlers = [${errorHandlers.map((_, i) => `errorHandler$${i}`).join(", ")}];

export default async function(error, event) {
  for (const handler of errorHandlers) {
    try {
      await handler(error, event);
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
