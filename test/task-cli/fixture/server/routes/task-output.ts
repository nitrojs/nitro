import { defineHandler } from "nitro";
import { runTask } from "nitro/task";

export default defineHandler(() => runTask("output"));
