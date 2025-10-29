import "#nitro-internal-pollyfills";
import consola from "consola";
import { HTTPError } from "nitro/deps/h3";
import { useNitroApp, useNitroHooks } from "nitro/runtime";
import { trapUnhandledNodeErrors } from "nitro/runtime/internal";

const nitroApp = useNitroApp();
const nitroHooks = useNitroHooks();

export const appFetch = nitroApp.fetch;

export const closePrerenderer = () => nitroHooks.callHook("close");

nitroHooks.hook("error", (error, context) => {
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
