import "#internal/nitro/virtual/polyfill";
import { nitroApp } from "nitropack/runtime/app";
import { useAppConfig } from "nitropack/runtime";

import functions from "firebase-functions";
import { toNodeListener } from "h3";

const firebaseConfig = useAppConfig().nitro.firebase;

export const __firebaseServerFunctionName__ = functions
  .region(firebaseConfig.region ?? functions.RESET_VALUE)
  .runWith(firebaseConfig.runtimeOptions ?? functions.RESET_VALUE)
  .https.onRequest(toNodeListener(nitroApp.h3App));
