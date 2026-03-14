import "#nitro/virtual/polyfills";
import { toNodeHandler } from "srvx/node";
import { useNitroApp } from "nitro/app";

export default toNodeHandler(useNitroApp().fetch);
