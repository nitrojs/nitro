import { defineHandler } from "nitro";

export default defineHandler((event) => ({
  auth: event.context.auth,
}));
