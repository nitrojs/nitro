import { glob } from "tinyglobby";
import { resolve } from "pathe";
import { joinURL, withLeadingSlash } from "ufo";
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
// manifest mapping each immutable static file to its full content hash (the file
// name may only contain a truncated hash).

const IMMUTABLE_MANIFEST = "immutable.json";

// Reserved Vercel namespace under which immutable static files are served.
// Used as the client `assetsDir` so content-addressed assets are emitted and
// referenced here.
export const IMMUTABLE_DIR = `_vercel/immutable${process.env.VERCEL_HASH_SALT ? `/${process.env.VERCEL_HASH_SALT}` : ""}`;

interface ImmutableManifest {
  version: 1;
  hashes: Record<string, string>;
}

export async function generateImmutableManifest(nitro: Nitro) {
  // Skip unless immutable static files are enabled (`vercel.immutableAssets`).
  if (!nitro.options.vercel?.immutableAssets) {
    return;
  }

  const publicDir = nitro.options.output.publicDir;
  const files = await glob(`${IMMUTABLE_DIR}/**`, {
    cwd: publicDir,
    absolute: false,
    dot: true,
  });

  const manifest: ImmutableManifest = { version: 1, hashes: {} };
  for (const file of files) {
    const pathname = withLeadingSlash(file);
    manifest.hashes[joinURL(nitro.options.baseURL, pathname)] = "";
  }

  await writeFile(
    resolve(nitro.options.output.dir, IMMUTABLE_MANIFEST),
    JSON.stringify(manifest, null, 2)
  );

  nitro.logger
    .withTag("vercel")
    .info(`Generated immutable manifest (${Object.keys(manifest.hashes).length} files).`);
}
