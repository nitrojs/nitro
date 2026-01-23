import type { NitroOptions } from "nitro/types";
import { resolveCompatibilityDatesFromEnv } from "compatx";

export async function resolveCompatibilityOptions(options: NitroOptions) {
  options.compatibilityDate = resolveCompatibilityDatesFromEnv(options.compatibilityDate);
}
