import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitropack/runtime";
import { useAppConfig } from "nitropack/runtime";

import functions from "firebase-functions/v1";
import { toNodeListener } from "h3";

const nitroApp = useNitroApp();

const firebaseConfig = useAppConfig().nitro.firebase;

export const __firebaseServerFunctionName__ = functions
  .region(firebaseConfig.region ?? functions.RESET_VALUE)
  .runWith(firebaseConfig.runtimeOptions ?? functions.RESET_VALUE)
  .https.onRequest(toNodeListener(nitroApp.h3App));
