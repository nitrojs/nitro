import { defineHandler, type EventHandler } from "h3";
import type { RenderHandler, RenderContext } from "nitro/types";
import { useNitroApp } from "./app";
import { useRuntimeConfig } from "./runtime-config";

export function defineRenderHandler(render: RenderHandler): EventHandler {
  const runtimeConfig = useRuntimeConfig();
  return defineHandler(async (event) => {
    const nitroApp = useNitroApp();

    // Create shared context for hooks
    const ctx: RenderContext = { event, render, response: undefined };

    // Call initial hook to prepare and optionally custom render
    await nitroApp.hooks.callHook("render:before", ctx);

    if (!ctx.response /* not handled by hook */) {
      // TODO: Use serve-placeholder
      if (event.url.pathname === `${runtimeConfig.app.baseURL}favicon.ico`) {
        event.res.headers.set("Content-Type", "image/x-icon");
        return "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
      }

      ctx.response = await ctx.render(event);

      if (!ctx.response) {
        const _currentStatus = event.res.status;
        event.res.statusText = String(
          _currentStatus === 200 ? 500 : _currentStatus
        );
        return (
          "No response returned from render handler: " + event.url.pathname
        );
      }
    }

    // Allow  modifying response
    await nitroApp.hooks.callHook("render:response", ctx.response, ctx);

    // Send headers
    if (ctx.response.headers) {
      for (const [key, value] of Object.entries(ctx.response.headers)) {
        event.res.headers.set(key, value);
      }
    }
    if (ctx.response.status || ctx.response.statusText) {
      event.res.status = ctx.response.status;
      event.res.statusText = ctx.response.statusText;
    }

    // Send response body
    return ctx.response.body;
  });
}
