import type { NitroErrorHandler } from "nitro";

const errorHandler: NitroErrorHandler = function (error, event) {
  event.res.end("[custom error handler] " + error.stack);
};

export default errorHandler;
