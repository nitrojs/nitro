import { defineHandler } from "nitro/h3";
import { useKV } from "nitro/kv";

export default defineHandler(async () => {
  const storage = useKV("server-timing");
  await Promise.all([storage.setItem("a", 1), storage.setItem("b", 2)]);
  return "ok";
});
