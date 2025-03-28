import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitro/runtime";
import { trapUnhandledNodeErrors } from "nitro/runtime/internal";

const nitroApp = useNitroApp();

export const appFetch = nitroApp.fetch;
export const closePrerenderer = () => nitroApp.hooks.callHook("close");

// Trap unhandled errors
trapUnhandledNodeErrors();
