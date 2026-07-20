import { defineHandler } from "nitro";

export default defineHandler((event) => `Hello (param: ${event.context.params!.name})!`);
