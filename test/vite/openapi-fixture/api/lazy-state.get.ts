import { defineHandler } from "nitro/h3";
import { state } from "../utils/lazy-state.ts";

export default defineHandler(() => ({ ...state }));
