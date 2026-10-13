import "./_runtime_warn.ts";
import type { NitroApp } from "nitro/types";
import type { ServerRequest } from "srvx";
import { H3Core } from "h3";
import errorHandler from "#nitro/virtual/error-handler";

export function createNitroApp(): NitroApp {
  const h3App = new H3Core({
    onError(error, event) {
      return errorHandler(error, event);
    },
  });
  const captureError: NonNullable<NitroApp["captureError"]> = (error, errorCtx) => {
    if (errorCtx?.event) {
      const errors = errorCtx.event.req.context?.nitro?.errors;
      if (errors) {
        errors.push({ error, context: errorCtx });
      }
    }
  };
  return {
    fetch: (req: ServerRequest) => {
      req.context ||= {};
      req.context.nitro = req.context.nitro || { errors: [] };
      return h3App.fetch(req);
    },
    h3: h3App,
    hooks: undefined,
    captureError,
  };
}

export function initNitroPlugins(app: NitroApp): NitroApp {
  return app;
}
