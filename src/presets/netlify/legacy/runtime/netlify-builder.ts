import "#nitro-internal-pollyfills";

import { builder } from "@netlify/functions";
import { lambda } from "./netlify-lambda";

export const handler = builder(lambda);
