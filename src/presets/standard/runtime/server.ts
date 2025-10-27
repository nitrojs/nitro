import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitro/runtime";

const nitroApp = useNitroApp();

export default {
  fetch: (req: Request) => nitroApp.fetch(req),
};
