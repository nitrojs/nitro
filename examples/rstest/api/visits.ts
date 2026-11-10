import { defineHandler } from "nitro";
import { useKV } from "nitro/kv";

export default defineHandler(async () => {
  const kv = useKV<number>();
  const visits = ((await kv.getItem("visits")) || 0) + 1;
  await kv.setItem("visits", visits);
  return { visits };
});
