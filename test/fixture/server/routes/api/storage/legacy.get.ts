import { defineHandler } from "nitro/h3";
import { useStorage } from "nitro/storage";

export default defineHandler(async (event) => {
  const base = event.url.searchParams.get("base") || "";
  const key = event.url.searchParams.get("key") || "";
  return await useStorage(`test:${base}`).getItem(key);
});
