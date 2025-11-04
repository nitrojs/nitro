import { fetchViteEnv } from "nitro/runtime/vite";

/** @param {{ req: Request }} HTTPEvent */
export default function ssrRenderer({ req }) {
  return fetchViteEnv("ssr", req);
}
