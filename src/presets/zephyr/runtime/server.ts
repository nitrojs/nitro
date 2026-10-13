import "#nitro/virtual/polyfills";
import { createHandler } from "../../cloudflare/runtime/_module-handler.ts";

export default createHandler({
  fetch() {},
});
