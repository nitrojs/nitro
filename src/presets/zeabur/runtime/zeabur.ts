import "#nitro-internal-pollyfills";
import { toNodeHandler } from "srvx/node";
import { useNitroApp } from "nitro/app";

export default toNodeHandler(useNitroApp().fetch);
