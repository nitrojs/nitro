import { defineHandler } from "nitro";
import { greet } from "../utils";

export default defineHandler(() => greet("nitro"));
