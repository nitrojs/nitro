import "#nitro/virtual/polyfills";
import { useNitroApp } from "nitro/app";

import { Server } from "node:http";
import type { NodeHttp1Handler } from "srvx";
import { toNodeHandler } from "srvx/node";

const nitroApp = useNitroApp();

const server = new Server(toNodeHandler(nitroApp.fetch) as NodeHttp1Handler);

// @ts-ignore
server.listen(3000, (err) => {
  if (err) {
    console.error(err);
  } else {
    console.log(`Listening on http://localhost:3000 (AWS Amplify Hosting)`);
  }
});
