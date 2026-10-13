import { defineHandler } from "nitro";
import { version } from "../utils/version.ts";

export default defineHandler(() => `hello ${version}`);
