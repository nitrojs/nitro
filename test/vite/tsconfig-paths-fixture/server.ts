import { aliased } from "@aliased";
import { viteAliased } from "@vite-aliased";
import { defu } from "defu";
import { fallback } from "@fallback";
import { greeting } from "@greeting";
import { HTTPError } from "nitro/h3";
import { sum } from "~app/utils/math";
// CommonJS packages mapped to types
import etag from "etag";
import xml2js from "xml2js";

export default {
  fetch(_req: Request) {
    return Response.json({
      greeting,
      sum: sum(1, 2),
      h3: typeof HTTPError,
      fallback,
      aliased,
      defu: defu({}, {}),
      viteAliased,
      etag: typeof etag,
      xml2js: typeof xml2js.parseString,
    });
  },
};
