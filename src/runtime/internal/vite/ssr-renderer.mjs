import { fetchViteEnv } from "nitro/vite/runtime";

/** @param {{ req: Request }} HTTPEvent */
export default function ssrRenderer({ req }) {
  return fetchViteEnv("ssr", req);
}
