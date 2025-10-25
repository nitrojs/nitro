import "#nitro-internal-pollyfills";
import consola from "consola";
import { HTTPError } from "nitro/deps/h3";
import { useNitroApp } from "nitro/runtime";
import { trapUnhandledNodeErrors } from "nitro/runtime/internal";

const nitroApp = useNitroApp();

export const appFetch = nitroApp.fetch;

export const closePrerenderer = () => nitroApp.hooks.callHook("close");

nitroApp.hooks.hook("error", (error, context) => {
  if (
    !(error as HTTPError).unhandled &&
    (error as HTTPError).status >= 500 &&
    context.event?.req?.headers instanceof Headers &&
    context.event.req.headers.get("x-nitro-prerender")
  ) {
    consola.error(
      `[prerender error]`,
      `[${context.event.req.method}]`,
      `[${context.event.req.url}]`,
      error
    );
  }
});

// Trap unhandled errors
trapUnhandledNodeErrors();
