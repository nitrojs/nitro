import { defineHandler } from "nitro/h3";
import { serverFetch } from "nitro";

export default defineHandler(() => serverFetch("/hello"));
