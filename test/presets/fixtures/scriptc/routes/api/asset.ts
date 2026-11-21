import { defineHandler } from "nitro";
import { useStorage } from "nitro/storage";

export default defineHandler(() => useStorage("assets:server").getItem("hello.txt"));
