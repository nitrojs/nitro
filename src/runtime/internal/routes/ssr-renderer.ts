import type { H3Event } from "h3";
import { fetchService } from "../services.ts";

export default function ssrRenderer(event: H3Event): Promise<Response> {
  return fetchService("ssr", event.req as Request);
}
