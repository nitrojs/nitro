import type { Nitro } from "nitro/types";

export default function polyfills(_nitro: Nitro, polyfills: string[]) {
  return {
    id: "#nitro/virtual/polyfills",
    moduleSideEffects: true,
    template: () => {
      return (
        polyfills.map((p) => /* js */ `import '${p}';`).join("\n") || /* js */ `/* No polyfills */`
      );
    },
  };
}
