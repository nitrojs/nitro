import { readFile } from "node:fs/promises";
import { dataURL } from "@fixture/asset-url-dep";

// Dependencies of services are external, and bundled by the Nitro build
export default {
  async fetch() {
    return Response.json({ href: dataURL.href, text: await readFile(dataURL, "utf8") });
  },
};
