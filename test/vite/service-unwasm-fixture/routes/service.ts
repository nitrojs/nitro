import { defineHandler } from "nitro";
import { fetchService } from "nitro/services";

export default defineHandler((event) => fetchService("ssr", event.req as Request));
