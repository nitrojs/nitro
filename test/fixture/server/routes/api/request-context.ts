import { defineHandler } from "nitro/h3";

export default defineHandler((event) => ({
  custom: event.context.custom === true,
}));
