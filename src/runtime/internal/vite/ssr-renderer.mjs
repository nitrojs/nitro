/** @param {{ req: Request }} HTTPEvent */
export default function ssrRenderer({ req }) {
  const { ssr } = globalThis.__nitro_vite_envs__ || {};
  return ssr
    ? ssr.fetch(req)
    : new Response("SSR environment is not ready", { status: 503 });
}
