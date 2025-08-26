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
    context.request &&
    !(error as HTTPError).unhandled &&
    (error as HTTPError).status >= 500 &&
    context.request.headers.get("x-nitro-prerender")
  ) {
    consola.error(
      `[prerender error]`,
      `[${context.request.method}]`,
      `[${context.request.url}]`,
      error
    );
  }
});

// Trap unhandled errors
trapUnhandledNodeErrors();
