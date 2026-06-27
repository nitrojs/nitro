import { defineHandler, serverFetch } from "nitro";

export default defineHandler(() => serverFetch("/hello"));
