import "#nitro-internal-pollyfills";
import { toNodeHandler } from "srvx/node";
import { useNitroApp } from "nitro/runtime";

export default toNodeHandler(useNitroApp().h3App.fetch);
