import { glob } from "tinyglobby";
import { resolve } from "pathe";
import { joinURL, withLeadingSlash } from "ufo";
import { provider } from "std-env";
import type { Nitro } from "nitro/types";
import { writeFile } from "../_utils/fs.ts";

// Immutable Static Files
//
// https://vercel.com/docs/build-output-api/primitives
//
// Immutable static files are content-addressed and shared across deployments which improves cross-deployment
// caching.
//
// Newer deployments must never overwrite an existing file with different content, so the file names embed a content hash.
//
// Alongside `.vercel/output/static`, we emit a `.vercel/output/immutable.json`
// manifest mapping each immutable static file URL to its full content hash. The
// spec allows using the file path itself as the "full content hash" when the
// name already carries enough entropy, which is what we do: emitted file names
// embed a 16 character content hash (see `useLongerAssetHashes`).

const IMMUTABLE_MANIFEST = "immutable.json";

interface ImmutableManifest {
  version: 1;
  hashes: Record<string, string>;
}

// Opt-in guard for immutable static files, run from `build:before`.
//
// Immutable static files are opt-in via `vercel.immutableStaticFiles` (defaulting
// to the `NITRO_VERCEL_IMMUTABLE_STATIC_FILES_ENABLED` env var). When running on
// Vercel, the platform advertises support through `VERCEL_IMMUTABLE_STATIC_FILES_ENABLED`.
// If the feature is enabled but the current deployment does not support it, or the
// app is served from a non-root `baseURL`, an immutable deploy would fail or silently
// not apply, so we disable it and warn instead of producing broken output.
export function setupImmutableStaticFiles(nitro: Nitro) {
  if (!nitro.options.vercel?.immutableStaticFiles) {
    return;
  }

  if (provider === "vercel" && !process.env.VERCEL_IMMUTABLE_STATIC_FILES_ENABLED) {
    nitro.options.vercel.immutableStaticFiles = false;
    nitro.logger
      .withTag("vercel")
      .warn(
        "Immutable static files are enabled but not supported by the current Vercel deployment (`VERCEL_IMMUTABLE_STATIC_FILES_ENABLED` is not set). Skipping immutable static files output."
      );
    return;
  }

  // `publicDir` is nested under `baseURL`, so a non-root base would emit assets
  // to `/<base>/_vercel/immutable/...` instead of the reserved `/_vercel/immutable/`
  // namespace. Vercel would not treat those as immutable, so opt out instead.
  if (nitro.options.baseURL !== "/") {
    nitro.options.vercel.immutableStaticFiles = false;
    nitro.logger
      .withTag("vercel")
      .warn(
        `Immutable static files are not supported with a non-root \`baseURL\` (\`${nitro.options.baseURL}\`), since they must be served from the reserved \`/_vercel/immutable/\` path. Skipping immutable static files output.`
      );
    return;
  }

  nitro.options.buildAssetsDir = immutableDir(nitro);
}

export async function generateImmutableManifest(nitro: Nitro) {
  // Skip unless immutable static files are enabled (`vercel.immutableStaticFiles`).
  if (!nitro.options.vercel?.immutableStaticFiles) {
    return;
  }

  const publicDir = nitro.options.output.publicDir;
  const files = await glob(`${nitro.options.buildAssetsDir}/**`, {
    cwd: publicDir,
    absolute: false,
    dot: true,
  });

  const manifest: ImmutableManifest = {
    version: 1,
    hashes: Object.fromEntries(
      files.map((file) => {
        const pathname = withLeadingSlash(file);
        const url = joinURL(nitro.options.baseURL, pathname);
        return [url, url];
      })
    ),
  };

  await writeFile(
    resolve(nitro.options.output.dir, IMMUTABLE_MANIFEST),
    JSON.stringify(manifest, null, 2)
  );

  const logger = nitro.logger.withTag("vercel");
  if (files.length === 0) {
    // Emitting no immutable files almost always means the client build did not
    // pick up `buildAssetsDir` (only the Nitro + Vite integration wires it up
    // automatically). Warn instead of silently writing an empty manifest.
    logger.warn(
      `Immutable static files are enabled but no assets were emitted under \`${nitro.options.buildAssetsDir}\`. Make sure your client build uses \`nitro.options.buildAssetsDir\` as its assets directory.`
    );
  } else {
    logger.info(`Generated immutable manifest (${files.length} files).`);
  }
}

// Reserved Vercel namespace under which immutable static files are served.
// Used as the client `buildAssetsDir` so content-addressed assets are emitted
// and referenced here. The path is namespaced by an optional hash salt and the
// framework name to avoid cross-framework collisions.
export function immutableDir(nitro: Nitro) {
  return normalizeBuildAssetsDir(
    joinURL(
      "_vercel/immutable",
      process.env.VERCEL_HASH_SALT || "",
      nitro.options.framework.name || ""
    )
  );
}

// Normalize a build assets directory into a bare relative path, stripping
// leading, trailing and duplicate slashes as well as `.` / `..` segments (a
// hand-set `VERCEL_HASH_SALT` must not escape the reserved namespace).
// Mirrors the same normalization applied to user config in `resolveURLOptions`.
function normalizeBuildAssetsDir(dir: string): string {
  return dir
    .split("/")
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .join("/");
}
