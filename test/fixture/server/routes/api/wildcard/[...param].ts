import { defineHandler } from "nitro/h3";

export default defineHandler((event) => {
  return event.context.params!.param as string;
});
