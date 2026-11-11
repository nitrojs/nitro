import "#nitro/virtual/polyfills";
import { serve } from "./_srvx.ts";

import { useNitroApp } from "nitro/app";
import { trapUnhandledErrors } from "#nitro/runtime/error/hooks";
import { resolveServeOptions } from "#nitro/runtime/serve";
import { setupCloseHooks } from "#nitro/runtime/shutdown";

const nitroApp = useNitroApp();

const server = serve(resolveServeOptions({ fetch: nitroApp.fetch }));

setupCloseHooks(server);

trapUnhandledErrors();

export default {};
