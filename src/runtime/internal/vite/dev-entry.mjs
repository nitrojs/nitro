import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitro/runtime";

const nitroApp = useNitroApp();

export const fetch = nitroApp.fetch;
