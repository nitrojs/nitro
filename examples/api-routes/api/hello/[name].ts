import { defineHandler } from "nitro/h3";

export default defineHandler((event) => `Hello (param: ${event.context.params!.name})!`);
