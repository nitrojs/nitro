import { defineHandler } from "nitro";
// @ts-ignore
import message from "virtual:build-plugin";

export default defineHandler(() => ({ message, transform: "__BUILD_PLUGIN_TRANSFORM__" }));
