import type { NitroConfig } from "nitro/types";
import { joinURL } from "ufo";
import { loadOptions } from "../../config/loader.ts";
import { createNitro } from "../../nitro.ts";
import {
  SCHEDULE_FUNCTION_PATH,
  SCHEDULE_HANDLER_ROUTE,
  getVercelBuildOutputSchedules,
  getVercelSchedulesMode,
  isVercelSchedulesEnabled,
} from "./schedules.ts";

import type { VercelFunctionTrigger, VercelSchedule } from "./types.ts";

export interface VercelDevManifest {
  /** Functions with a deployment identity, and where the dev server serves them. Empty in `path` mode. */
  functions: {
    /** Build Output API function path, without a leading slash or `.func` suffix. */
    outputPath: string;
    invocation: { type: "http"; pathname: string };
    experimentalTriggers: VercelFunctionTrigger[];
  }[];
  /** Build Output API `schedules`, as emitted by `nitro build`. */
  schedules: VercelSchedule[];
}

/**
 * Describes the Vercel functions and schedules of a Nitro app for `vercel dev`, without
 * building it or starting a server. `vercel dev` registers the schedules with its local
 * Schedules broker, which invokes the dev server at the listed pathnames.
 *
 * Returns an empty manifest unless scheduled tasks are emitted as Vercel Schedules
 * (`vercel.schedules` or `NITRO_VERCEL_SCHEDULES`) and `nitro dev` uses the Vercel
 * preset, which hands scheduled tasks over to the `vercel dev` broker. Otherwise the
 * in-process scheduler of `nitro dev` keeps running them.
 *
 * @experimental
 */
export async function getVercelDevManifest(
  opts: { rootDir?: string; config?: NitroConfig } = {}
): Promise<VercelDevManifest> {
  const rootDir = opts.rootDir ?? opts.config?.rootDir;
  const devOptions = await loadOptions({ ...opts.config, rootDir, dev: true });
  if (devOptions.preset !== "vercel-dev" || !isVercelSchedulesEnabled(devOptions)) {
    return { functions: [], schedules: [] };
  }

  // Resolve the production preset so that schedules match `nitro build` output.
  const nitro = await createNitro({
    ...opts.config,
    rootDir,
    preset: "vercel",
    dev: false,
  });
  try {
    if (!isVercelSchedulesEnabled(nitro.options)) {
      return { functions: [], schedules: [] };
    }
    const schedules = getVercelBuildOutputSchedules(nitro);
    if (schedules.length === 0) {
      return { functions: [], schedules: [] };
    }
    if (getVercelSchedulesMode(nitro.options) === "path") {
      return { functions: [], schedules };
    }
    return {
      functions: [
        {
          outputPath: SCHEDULE_FUNCTION_PATH,
          invocation: {
            type: "http",
            pathname: joinURL(nitro.options.baseURL, SCHEDULE_HANDLER_ROUTE),
          },
          experimentalTriggers: [{ type: "schedule/v1beta" }],
        },
      ],
      schedules,
    };
  } finally {
    await nitro.close();
  }
}
