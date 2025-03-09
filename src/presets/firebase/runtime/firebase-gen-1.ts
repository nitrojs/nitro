import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitro/runtime";

import functions from "firebase-functions";
import { toNodeListener } from "h3";

const nitroApp = useNitroApp();

// TODO: add options support back using virtual template
const firebaseConfig = {} as any;

export const __firebaseServerFunctionName__ = functions
  .region(firebaseConfig.region ?? functions.RESET_VALUE)
  .runWith(firebaseConfig.runtimeOptions ?? functions.RESET_VALUE)
  .https.onRequest(toNodeListener(nitroApp.h3App));
