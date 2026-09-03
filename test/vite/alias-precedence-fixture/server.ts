import { dispatcher } from "#pkg/network-dispatcher";
import { pkgName } from "#pkg/meta";

export default {
  fetch(_req: Request) {
    return Response.json({ dispatcher, pkgName });
  },
};
