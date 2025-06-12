import "#nitro-internal-pollyfills";
import consola from "consola";
import { getRequestHeader, getRequestURL, H3Error, isEvent } from "h3";
import { useNitroApp } from "nitro/runtime";
import { trapUnhandledNodeErrors } from "nitro/runtime/internal";

const nitroApp = useNitroApp();

export const appFetch = nitroApp.fetch;

export const closePrerenderer = () => nitroApp.hooks.callHook("close");

nitroApp.hooks.hook("error", (error, context) => {
  if (
    isEvent(context.event) &&
    !(error as H3Error).unhandled &&
    (error as H3Error).statusCode >= 500 &&
    getRequestHeader(context.event, "x-nitro-prerender")
  ) {
    const url = getRequestURL(context.event).href;
    consola.error(
      `[prerender error]`,
      `[${context.event.method}]`,
      `[${url}]`,
      error
    );
  }
});

// Trap unhandled errors
trapUnhandledNodeErrors();
