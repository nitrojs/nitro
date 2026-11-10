import { useRuntimeConfig } from "nitro/runtime-config";

export default {
  fetch(req) {
    const { pathname } = new URL(req.url);
    return `<p id="ssr">${pathname} ${useRuntimeConfig().greeting}</p>`;
  },
};
