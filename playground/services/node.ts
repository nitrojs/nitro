import type { IncomingMessage, ServerResponse } from "node:http";
import { toReqRes, toFetchResponse } from "fetch-to-node";

const nodeHandler = (req: IncomingMessage, res: ServerResponse) => {
  setImmediate(() => {
    res.end("Hello from Node.js handler!");
  });
};

export const fetch = async (webReq: Request) => {
  const { req, res } = toReqRes(webReq);
  nodeHandler(req as IncomingMessage, res as ServerResponse);
  return toFetchResponse(res as ServerResponse);
};
