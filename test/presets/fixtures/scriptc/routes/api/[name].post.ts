import { defineHandler } from "nitro";

export default defineHandler(async (event) => ({
  name: event.context.params?.name,
  user: event.context.user,
  body: await event.req.text(),
}));
