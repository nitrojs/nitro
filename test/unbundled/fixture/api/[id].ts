import { defineHandler } from "nitro";
import { useRuntimeConfig } from "nitro/runtime-config";

export default defineHandler((event) => ({
  id: event.context.params?.id,
  hasRuntimeConfig: "app" in useRuntimeConfig(),
}));
