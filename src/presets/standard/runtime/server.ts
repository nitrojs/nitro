import "#nitro/virtual/polyfills";
import { useNitroApp } from "nitro/app";

const nitroApp = useNitroApp();

export default {
  fetch: nitroApp.fetch,
};
