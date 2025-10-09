/** @param {{ req: Request }} HTTPEvent */
export default function ssrRenderer({ req }) {
  return fetch(req, { viteEnv: "ssr" });
}
