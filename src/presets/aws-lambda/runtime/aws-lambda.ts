import "#nitro/virtual/polyfills";
import { handleLambdaEvent } from "srvx/aws-lambda";
import { useNitroApp } from "nitro/app";

import type { AwsLambdaEvent } from "srvx/aws-lambda";
import type { Context } from "aws-lambda";

const nitroApp = useNitroApp();

export async function handler(event: AwsLambdaEvent, context: Context) {
  return handleLambdaEvent(nitroApp.fetch, event, context);
}
