import { useRuntimeConfig } from "nitro/runtime-config";

export default {
  fetch(req: Request) {
    const { pathname } = new URL(req.url);
    return new Response(`<h1>${useRuntimeConfig().greeting} from ${pathname}</h1>`, {
      headers: { "content-type": "text/html" },
    });
  },
};
