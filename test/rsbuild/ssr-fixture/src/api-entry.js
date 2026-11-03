import { useRuntimeConfig } from "nitro/runtime-config";
import { fetchService } from "nitro/services";

export default {
  async fetch(req) {
    const page = await fetchService("ssr", req);
    return Response.json({ service: "api", greeting: useRuntimeConfig().greeting, page });
  },
};
