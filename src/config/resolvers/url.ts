import type { NitroOptions } from "nitro/types";
import { withLeadingSlash, withTrailingSlash } from "ufo";

export async function resolveURLOptions(options: NitroOptions) {
  options.baseURL = withLeadingSlash(withTrailingSlash(options.baseURL));

  if (options.buildAssetsDir !== undefined) {
    options.buildAssetsDir = normalizeBuildAssetsDir(options.buildAssetsDir) || undefined;
  }
}

// Normalize a build assets directory into a bare relative path, stripping
// leading, trailing and duplicate slashes as well as `.` / `..` segments, so it
// can be safely interpolated into bundler filename and glob patterns.
function normalizeBuildAssetsDir(dir: string): string {
  return dir
    .split("/")
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .join("/");
}
