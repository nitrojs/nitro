import "./_runtime_warn.ts";
import { H3Event, toResponse } from "h3";
import type { NitroErrorHandler } from "nitro/types";

type EParams = Parameters<NitroErrorHandler>;
type EReturn = ReturnType<NitroErrorHandler>;

const errorHandler: (error: EParams[0], event: EParams[1]) => EReturn = (error, event) => {
  if (error.status !== 404) {
    console.error(error as any);
  }
  return toResponse(error, event as H3Event);
};

export default errorHandler;
