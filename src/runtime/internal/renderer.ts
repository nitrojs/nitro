import {
  H3Event,
  eventHandler,
  getResponseStatus,
  send,
  setResponseHeader,
  setResponseHeaders,
  setResponseStatus,
} from "h3";
import type { RenderHandler, RenderContext } from "nitropack/types";
import { useNitroApp } from "./app";
import { useRuntimeConfig } from "./config";

export function defineRenderHandler(render: RenderHandler) {
  const runtimeConfig = useRuntimeConfig();
  return eventHandler(async (event) => {
    const nitroApp = useNitroApp();

    // Create shared context for hooks
    const ctx: RenderContext = { event, render, response: undefined };

    // Call initial hook to prepare and optionally custom render
    await nitroApp.hooks.callHook("render:before", ctx);

    if (!ctx.response /* not handled by hook */) {
      // TODO: Use serve-placeholder
      if (event.path === `${runtimeConfig.app.baseURL}favicon.ico`) {
        setResponseHeader(event, "Content-Type", "image/x-icon");
        return send(
          event,
          "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
        );
      }

      ctx.response = await ctx.render(event);

      if (!ctx.response) {
        const _currentStatus = getResponseStatus(event);
        setResponseStatus(event, _currentStatus === 200 ? 500 : _currentStatus);
        return send(
          event,
          "No response returned from render handler: " + event.path
        );
      }
    }

    // Allow  modifying response
    await nitroApp.hooks.callHook("render:response", ctx.response, ctx);

    // Send headers
    if (ctx.response.headers) {
      setResponseHeaders(event, ctx.response.headers);
    }
    if (ctx.response.statusCode || ctx.response.statusMessage) {
      setResponseStatus(
        event,
        ctx.response.statusCode,
        ctx.response.statusMessage
      );
    }

    // Send response body
    return ctx.response.body;
  });
}
