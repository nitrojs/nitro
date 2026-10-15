import { defineCachedHandler } from "nitro/cache";

export default defineCachedHandler(() => ({ timestamp: Date.now() }), {
  name: "server-timing-handler",
  maxAge: 60,
});
