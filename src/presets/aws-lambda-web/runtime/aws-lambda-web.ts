import "#nitro/virtual/polyfills";
import { startNodeServer } from "../../node/runtime/_server.ts";

const endpoint = process.env.AWS_LAMBDA_HTTP_ENDPOINT;
const match = endpoint?.match(/^([^:]+):(\d+)$/);

if (endpoint !== undefined && (!match || +match[2] < 1 || +match[2] > 65_535)) {
  throw new Error(`Invalid AWS_LAMBDA_HTTP_ENDPOINT: ${endpoint}`);
}

startNodeServer(match ? { hostname: match[1], port: +match[2] } : {});

export default {};
