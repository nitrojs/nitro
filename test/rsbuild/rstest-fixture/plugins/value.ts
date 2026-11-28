import { definePlugin } from "nitro";
import { value } from "../utils/value.ts";

export default definePlugin(() => {
  (globalThis as any).__pluginValue = value;
});
