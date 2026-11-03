import type { H3Event } from "h3";

// Imported on each request: the Vite dev server reloads the template module alone (without its
// importers, so the app is not restarted) when the page HTML changes.
export default async function renderIndexHTML(event: H3Event): Promise<any> {
  const { rendererTemplate } = await import("#nitro/virtual/renderer-template");
  return rendererTemplate(event.req as Request);
}
