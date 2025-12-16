import { defineHandler } from "nitro/h3";

export default defineHandler((event) => event.url.pathname);
