import type { H3Event } from "h3";
import { rendererTemplate } from "#nitro-internal-virtual/renderer-template";

export default function renderIndexHTML(event: H3Event) {
  event.res.headers.set("content-type", "text/html; charset=utf-8");
  return rendererTemplate();
}
