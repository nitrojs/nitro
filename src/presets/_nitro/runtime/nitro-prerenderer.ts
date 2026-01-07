import "#nitro-internal-pollyfills";
import consola from "consola";
import { getRequestHeader, getRequestURL, H3Error, isEvent } from "h3";
import { useNitroApp } from "nitropack/runtime";
import { trapUnhandledNodeErrors } from "nitropack/runtime/internal";

const nitroApp = useNitroApp();

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

export const localFetch = nitroApp.localFetch;
export const closePrerenderer = () => nitroApp.hooks.callHook("close");

// Trap unhandled errors
trapUnhandledNodeErrors();
