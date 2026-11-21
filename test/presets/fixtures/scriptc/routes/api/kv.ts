import { defineHandler } from "nitro";
import { useStorage } from "nitro/storage";

export default defineHandler(async () => {
  await useStorage().setItem("data", { value: 1 });
  return useStorage().getItem("data");
});
