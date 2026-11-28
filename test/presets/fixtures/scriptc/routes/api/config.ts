import { defineHandler } from "nitro";
import { useRuntimeConfig } from "nitro/runtime-config";

export default defineHandler((event) => ({
  greeting: useRuntimeConfig().greeting,
  query: Object.fromEntries(event.url.searchParams),
}));
