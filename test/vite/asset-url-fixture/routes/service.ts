import { defineHandler } from "nitro";
import { fetchViteEnv } from "nitro/vite/runtime";

export default defineHandler((event) => fetchViteEnv("api", event.req as Request));
