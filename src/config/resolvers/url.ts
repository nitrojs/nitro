import type { NitroOptions } from "nitro/types";
import { withLeadingSlash, withTrailingSlash } from "ufo";

export async function resolveURLOptions(options: NitroOptions) {
  options.baseURL = withLeadingSlash(withTrailingSlash(options.baseURL));
}
