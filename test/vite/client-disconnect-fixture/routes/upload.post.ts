import { defineHandler } from "nitro";

export default defineHandler(async (event) => `received ${(await event.req.text()).length}`);
