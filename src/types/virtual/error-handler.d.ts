import type { NitroErrorHandler } from "nitro/types";

type EParams = Parameters<NitroErrorHandler>;
type EReturn = ReturnType<NitroErrorHandler>;

const errorHandler: (error: EParams[0], event: EParams[1]) => EReturn;

export default errorHandler;
