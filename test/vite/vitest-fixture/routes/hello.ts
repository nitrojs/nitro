import { defineHandler } from "nitro";
import { useRuntimeConfig } from "nitro/runtime-config";

export default defineHandler(() => ({ greeting: useRuntimeConfig().greeting }));
