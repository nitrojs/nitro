import type { Nitro } from "nitro/types";
import { klona } from "klona";
import { createStorage as _createStorage, builtinDrivers } from "unstorage";
import { useRuntimeConfig } from "nitro/runtime";

export async function createStorage(nitro: Nitro) {
  const storage = _createStorage();
  const runtime = useRuntimeConfig();
  // https://github.com/unjs/unstorage/issues/566
  const mounts = klona({
    ...nitro.options.storage,
    ...nitro.options.devStorage,
  });

  for (const [path, opts] of Object.entries(mounts)) {
    if (opts.driver) {
      const driver = await import(
        builtinDrivers[opts.driver as keyof typeof builtinDrivers] ||
          opts.driver
      ).then((r) => r.default || r);

      // Process options to replace runtime values
      const processedOpts = replaceRuntimeValues({ ...opts }, runtime);
      storage.mount(path, driver(processedOpts));
    } else {
      nitro.logger.warn(`No \`driver\` set for storage mount point "${path}".`);
    }
  }

  return storage;
}

export async function snapshotStorage(nitro: Nitro) {
  const data: Record<string, any> = {};

  const allKeys = [
    ...new Set(
      await Promise.all(
        nitro.options.bundledStorage.map((base) => nitro.storage.getKeys(base))
      ).then((r) => r.flat())
    ),
  ];

  await Promise.all(
    allKeys.map(async (key) => {
      data[key] = await nitro.storage.getItem(key);
    })
  );

  return data;
}

/**
 * Recursively replaces values starting with 'runtime.' with their actual values from runtime config
 */
export function replaceRuntimeValues(obj: any, runtime: any): any {
  if (!obj || typeof obj !== "object") return obj;

  for (const key in obj) {
    if (typeof obj[key] === "string" && obj[key].startsWith("runtime.")) {
      // Extract the path after 'runtime.'
      const runtimePath = obj[key].slice(8).split(".");
      let value = runtime;

      // Navigate to the nested property in runtime object
      for (const segment of runtimePath) {
        if (value === undefined || value === null) break;
        value = value[segment];
      }

      if (value !== undefined) obj[key] = value;
    } else if (typeof obj[key] === "object" && obj[key] !== null) {
      obj[key] = replaceRuntimeValues(obj[key], runtime);
    }
  }

  return obj;
}
