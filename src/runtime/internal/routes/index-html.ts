import type { H3Event } from "h3";
import { indexHTML } from "#nitro-internal-virtual/index-html";

export default async function renderIndexHTML(event: H3Event) {
  const html = await indexHTML();
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
