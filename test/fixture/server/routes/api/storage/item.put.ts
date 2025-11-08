import { defineHandler } from "nitro/h3";
import { useStorage } from "nitro/runtime";

export default defineHandler(async (event) => {
  const base = event.url.searchParams.get("base") || "";
  const key = event.url.searchParams.get("key") || "";
  const storage = useStorage(`test:${base}`);
  const value = await event.req.text();
  await storage.setItem(key, value);
  return value;
});
