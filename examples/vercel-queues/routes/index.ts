import { defineHandler } from "nitro";

export default defineHandler(() => ({ queue: "vercel-queues" }));
