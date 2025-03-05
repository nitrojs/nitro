import "#nitro-internal-pollyfills";
import { type NodeListener, toNodeListener } from "h3";
import { useNitroApp } from "nitro/runtime";

const handler = toNodeListener(useNitroApp().h3App);

const listener: NodeListener = function (req, res) {
  return handler(req, res);
};

export default listener;
