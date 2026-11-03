import { defineHandler } from "nitro";
import { fetchService } from "nitro/services";

export default defineHandler((event) => fetchService("api", event.req as Request));
