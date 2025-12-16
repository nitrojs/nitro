import type { H3Event } from "h3";
import { rendererTemplate } from "#nitro/virtual/renderer-template";

export default function renderIndexHTML(event: H3Event) {
  return rendererTemplate(event.req as Request);
}
