import { defineCachedHandler } from "nitro/cache";

export default defineCachedHandler(() => "cached", { maxAge: 60 });
