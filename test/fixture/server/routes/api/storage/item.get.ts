import { defineHandler } from "nitro/h3";
import { useKV } from "nitro/kv";

export default defineHandler(async (event) => {
  const base = event.url.searchParams.get("base") || "";
  const key = event.url.searchParams.get("key") || "";
  const storage = useKV(`test:${base}`);

  if (!key || key.endsWith(":")) {
    return await storage.getKeys();
  }

  const value = await storage.getItem(key);
  return value;
});
