import "#nitro-internal-pollyfills";
import consola from "consola";
import { getRequestURL, HTTPError, isEvent } from "h3";
import { useNitroApp } from "nitro/runtime";
import { trapUnhandledNodeErrors } from "nitro/runtime/internal";

const nitroApp = useNitroApp();

export const appFetch = nitroApp.fetch;

export const closePrerenderer = () => nitroApp.hooks.callHook("close");

nitroApp.hooks.hook("error", (error, context) => {
  if (
    isEvent(context.event) &&
    !(error as HTTPError).unhandled &&
    (error as HTTPError).status >= 500 &&
    context.event.req.headers.get("x-nitro-prerender")
  ) {
    const url = getRequestURL(context.event).href;
    consola.error(
      `[prerender error]`,
      `[${context.event.req.method}]`,
      `[${url}]`,
      error
    );
  }
});

// Trap unhandled errors
trapUnhandledNodeErrors();
