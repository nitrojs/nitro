import {
  type DateString,
  formatDate,
  resolveCompatibilityDatesFromEnv,
} from "compatx";
import _consola from "consola";
import { colors } from "consola/utils";
import type { NitroOptions } from "nitro/types";
import { relative } from "pathe";

// Nitro v2.9.6 release
export const fallbackCompatibilityDate = "2024-04-03" as DateString;

export async function resolveCompatibilityOptions(options: NitroOptions) {
  // Normalize and expand compatibility date from environment variables
  options.compatibilityDate = resolveCompatibilityDatesFromEnv(
    options.compatibilityDate
  );

  // If no compatibility date is specified, prompt or notify the user to set it
  if (
    !options.compatibilityDate.default &&
    options.preset !== "nitro-prerender"
  ) {
    options.compatibilityDate.default = await _resolveDefault(options);
  }
}

let _fallbackInfoShown = false;
let _promptedUserToUpdate = false;

async function _resolveDefault(options: NitroOptions): Promise<DateString> {
  const _todayDate = formatDate(new Date());

  const consola = _consola.withTag("nitro");
  consola.warn(`No valid compatibility date is specified.`);

  const onFallback = () => {
    if (!_fallbackInfoShown) {
      consola.info(
        [
          `Using \`${fallbackCompatibilityDate}\` as fallback.`,
          `  Please specify compatibility date to avoid unwanted behavior changes:`,
          `     - Add \`compatibilityDate: '${_todayDate}'\` to the config file.`,
          `     - Or set \`COMPATIBILITY_DATE=${_todayDate}\` environment variable.`,
          ``,
        ].join("\n")
      );
      _fallbackInfoShown = true;
    }
    return fallbackCompatibilityDate;
  };

  // Prompt user (once) to attempt auto update (only with Nitro CLI dev command)
  const shallUpdate =
    options._cli?.command === "dev" &&
    !_promptedUserToUpdate &&
    (await consola.prompt(
      `Do you want to auto update config file to set ${colors.cyan(`compatibilityDate: '${_todayDate}'`)}?`,
      {
        type: "confirm",
        default: true,
      }
    ));
  _promptedUserToUpdate = true;
  if (!shallUpdate) {
    return onFallback();
  }

  const { updateConfig } = await import("c12/update");
  const updateResult = await updateConfig({
    configFile: "nitro.config",
    cwd: options.rootDir,
    async onCreate({ configFile }) {
      const shallCreate = await consola.prompt(
        `Do you want to initialize a new config in ${colors.cyan(relative(".", configFile))}?`,
        {
          type: "confirm",
          default: true,
        }
      );
      if (shallCreate !== true) {
        return false;
      }
      return _getDefaultNitroConfig();
    },
    async onUpdate(config) {
      config.compatibilityDate = _todayDate;
    },
  }).catch((error) => {
    consola.error(`Failed to update config: ${error.message}`);
    return null;
  });

  if (updateResult?.configFile) {
    consola.success(
      `Compatibility date set to \`${_todayDate}\` in \`${relative(".", updateResult.configFile)}\``
    );
    return _todayDate;
  }

  return onFallback();
}

function _getDefaultNitroConfig() {
  return /* js */ `
import { defineNitroConfig } from 'nitro/config'

export default defineNitroConfig({})
  `;
}
