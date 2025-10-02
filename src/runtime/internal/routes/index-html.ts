import type { H3Event } from "h3";
import { indexHTML } from "#nitro-internal-virtual/index-html";

export default function renderIndexHTML(event: H3Event) {
  event.res.headers.set("content-type", "text/html; charset=utf-8");
  return indexHTML();
}
