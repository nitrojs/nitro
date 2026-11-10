import "./_runtime_warn.ts";

export function rendererTemplate(_req: Request): Response | Promise<Response> | string {
  return new Response(`<!-- Renderer template not available -->`);
}
