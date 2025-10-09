import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitro/runtime";

import { Server } from "node:http";
import { toNodeHandler } from "srvx/node";

const nitroApp = useNitroApp();

const server = new Server(toNodeHandler(nitroApp.fetch));

// @ts-ignore
server.listen(3000, (err) => {
  if (err) {
    console.error(err);
  } else {
    console.log(`Listening on http://localhost:3000 (AWS Amplify Hosting)`);
  }
});
