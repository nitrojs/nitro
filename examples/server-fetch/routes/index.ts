import { defineHandler } from "nitro/h3";
import { fetch } from "nitro";

export default defineHandler(() => fetch("/hello"));
