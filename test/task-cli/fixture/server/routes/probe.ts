import { defineHandler } from "nitro";
import { ready } from "../../events.ts";

export default defineHandler(() => ({ ready }));
