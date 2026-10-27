import { defineHandler } from "nitro";
import cjs from "@fixture/nitro-cjs";

export default defineHandler(() => ({ value: cjs(), runtime: cjs.runtime }));
