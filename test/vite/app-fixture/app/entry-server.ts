import { HTTPError } from "h3";
import { useStorage } from "nitro/storage";
import { useRuntimeConfig } from "nitro/runtime-config";

export default {
  async fetch(req: Request) {
    if (req.url.includes("?error")) {
      throw new HTTPError({ status: 418, headers: { "x-test": "123" } });
    }
    const storage = useStorage();
    const config = useRuntimeConfig();
    await storage.set("test:key", "value-from-ssr");
    const value = await storage.get("test:key");
    return Response.json({
      storage: value,
      config: config.nitro?.envPrefix ?? "NITRO_",
    });
  },
};
