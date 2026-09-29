import { DurableObject } from "cloudflare:workers";

export class ExportsCounter extends DurableObject {
  override fetch() {
    return Response.json({ source: "exports.cloudflare.ts" });
  }
}
