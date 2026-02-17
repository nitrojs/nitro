import type { Nitro } from "nitro/types";
import { resolve, normalize, relative } from "pathe";
import { existsSync } from "node:fs";
import {
  type ZephyrEngine,
  buildAssetsMap,
  handleGlobalError,
  readDirRecursiveWithContents,
  zeBuildDashData,
  ze_log,
} from "zephyr-agent";

export function createUploadRunner({
  nitro,
  zephyrEngineDefer,
  initEngine,
}: {
  nitro: Nitro;
  zephyrEngineDefer: Promise<ZephyrEngine>;
  initEngine: () => void;
}) {
  let uploadCalled = false;
  return async () => {
    if (uploadCalled) return;
    uploadCalled = true;
    initEngine();

    try {
      const zephyr_engine = await zephyrEngineDefer;
      ze_log.upload("Nuxt build done. Preparing Zephyr upload...");

      const serverDir = resolve(nitro.options.output.dir, nitro.options.output.serverDir);

      const publicDir = resolve(nitro.options.output.dir, nitro.options.output.publicDir);

      let entrypoint: string | undefined = resolve(serverDir, "index.mjs");

      if (!existsSync(entrypoint)) {
        entrypoint = undefined;
      }

      const snapshotType = entrypoint ? "ssr" : "csr";

      ze_log.upload(`Zephyr upload starting. snapshotType=${snapshotType} output=${publicDir}`);
      if (entrypoint) {
        ze_log.upload(`Zephyr entrypoint: ${entrypoint}`);
      }

      zephyr_engine.env.ssr = snapshotType === "ssr";
      zephyr_engine.buildProperties.output = publicDir;
      zephyr_engine.buildProperties.baseHref = nitro.options.baseURL;

      const files = await readDirRecursiveWithContents(nitro.options.output.dir);
      if (!files.length) {
        ze_log.upload(`No build output found in ${publicDir}`);
        return;
      }

      const assets: Record<string, Buffer> = files.reduce(
        (memo, file) => {
          const relativePath = normalize(file.relativePath);
          memo[relativePath] = file.content;
          return memo;
        },
        {} as Record<string, Buffer>
      );

      const assetsMap = buildAssetsMap(
        assets,
        (asset) => asset,
        () => "buffer"
      );

      await zephyr_engine.upload_assets({
        assetsMap,
        buildStats: await zeBuildDashData(zephyr_engine),
        snapshotType,
        entrypoint: relative(nitro.options.rootDir, entrypoint || ""),
      });

      await zephyr_engine.build_finished();
      ze_log.upload("Zephyr upload complete.");
    } catch (error) {
      handleGlobalError(error);
    }
  };
}
