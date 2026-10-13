import { defineHandler } from "nitro/h3";

export default defineHandler((event) => ({ id: event.context.params?.id }));
