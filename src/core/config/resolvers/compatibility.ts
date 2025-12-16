import type { DateString } from "compatx";
import type { NitroOptions } from "nitropack/types";
import { formatDate, resolveCompatibilityDatesFromEnv } from "compatx";
import _consola from "consola";
import { colors } from "consola/utils";
import { isTest } from "std-env";

// Nitro v2.9.6 release
export const fallbackCompatibilityDate = "2024-04-03" as DateString;

let _fallbackInfoShown = false;

export async function resolveCompatibilityOptions(options: NitroOptions) {
  // Normalize and expand compatibility date from environment variables
  options.compatibilityDate = resolveCompatibilityDatesFromEnv(
    options.compatibilityDate
  );

  // If no compatibility date is specified, prompt or notify the user to set it
  if (!options.compatibilityDate.default) {
    const consola = _consola.withTag("nitro");
    if (
      !_fallbackInfoShown &&
      !isTest &&
      options.preset !== "nitro-prerender"
    ) {
      consola.warn(
        [
          /* WARN */ `Please add \`compatibilityDate: '${formatDate("latest")}'\` to the config file. Using \`${fallbackCompatibilityDate}\` as fallback.`,
          `       More info: ${colors.underline("https://nitro.build/deploy#compatibility-date")}`,
        ].join("\n")
      );
      _fallbackInfoShown = true;
    }
  }
}
