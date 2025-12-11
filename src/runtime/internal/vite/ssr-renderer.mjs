import { fetchViteEnv } from "#vite-runtime";

/** @param {{ req: Request }} HTTPEvent */
export default function ssrRenderer({ req }) {
  return fetchViteEnv("ssr", req);
}
