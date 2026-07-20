import { defineHandler } from "nitro";
import { fetch } from "nitro";

export default defineHandler(() => fetch("/hello"));
