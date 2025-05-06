import type { NitroErrorHandler } from "nitropack/types";

type EParams = Parameters<NitroErrorHandler>;
type EReturn = ReturnType<NitroErrorHandler>;

const errorHandler: (error: EParams[0], event: EParams[1]) => EReturn;

export default errorHandler;
