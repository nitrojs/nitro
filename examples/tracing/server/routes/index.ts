import { defineHandler } from "nitro";
import { useStorage } from "nitro/storage";

// Reads and writes storage so the request emits `unstorage.*` spans (CLIENT)
// alongside the `srvx.request`, `middleware` and route (`h3.request`) spans.
export default defineHandler(async () => {
  const storage = useStorage();
  const hits = ((await storage.getItem<number>("hits")) ?? 0) + 1;
  await storage.setItem("hits", hits);
  return { message: "Hello from the Nitro tracing demo", hits };
});
