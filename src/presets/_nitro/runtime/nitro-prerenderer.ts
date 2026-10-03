import "#nitro/virtual/polyfills";
import { HTTPError } from "h3";
import { useNitroApp, useNitroHooks } from "nitro/app";

const nitroApp = useNitroApp();
const nitroHooks = useNitroHooks();

export default {
  fetch: nitroApp.fetch,
  close: () => nitroHooks.callHook("close"),
};

nitroHooks.hook("error", (error, context) => {
  if (
    !(error as HTTPError).unhandled &&
    (error as HTTPError).status >= 500 &&
    context.event?.req?.headers instanceof Headers &&
    context.event.req.headers.get("x-nitro-prerender")
  ) {
    console.error(
      `[prerender error]`,
      `[${context.event.req.method}]`,
      `[${context.event.req.url}]`,
      error
    );
  }
});
