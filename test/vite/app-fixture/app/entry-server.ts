import { useStorage } from "nitro/storage";
import { useRuntimeConfig } from "nitro/runtime-config";

export default {
  async fetch() {
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
