import { aliased } from "@aliased";
import { defu } from "defu";
import { fallback } from "@fallback";
import { greeting } from "@greeting";
import { HTTPError } from "nitro/h3";
import { sum } from "~app/utils/math";

export default {
  fetch(_req: Request) {
    return Response.json({
      greeting,
      sum: sum(1, 2),
      h3: typeof HTTPError,
      fallback,
      aliased,
      defu: defu({}, {}),
    });
  },
};
