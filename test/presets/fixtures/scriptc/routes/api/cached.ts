import { defineCachedHandler } from "nitro/cache";

let count = 0;

export default defineCachedHandler(() => ({ count: ++count }), { maxAge: 60 });
