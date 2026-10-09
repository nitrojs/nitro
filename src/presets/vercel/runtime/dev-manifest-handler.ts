import { defineHandler } from "nitro/h3";

/** Serves the dev manifest that `vercel dev` fetches from the dev server. */
export function createDevManifestHandler(manifest: unknown) {
  return defineHandler(() => manifest);
}
