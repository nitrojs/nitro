import { defineHandler } from "nitro/h3";
import { useKV } from "nitro/kv";

export default defineHandler(async () => {
  await useKV("test").setItem("foo", "bar");
  return { value: await useKV().getItem("test:foo") };
});
