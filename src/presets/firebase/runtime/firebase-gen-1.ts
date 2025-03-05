import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitro/runtime";
import { useAppConfig } from "nitro/runtime";

import functions from "firebase-functions";
import { toNodeListener } from "h3";

const nitroApp = useNitroApp();

const firebaseConfig = useAppConfig().nitro.firebase;

export const __firebaseServerFunctionName__ = functions
  .region(firebaseConfig.region ?? functions.RESET_VALUE)
  .runWith(firebaseConfig.runtimeOptions ?? functions.RESET_VALUE)
  .https.onRequest(toNodeListener(nitroApp.h3App));
