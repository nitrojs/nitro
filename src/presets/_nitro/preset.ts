import worker from "./base-worker.ts";
import dev from "./nitro-dev.ts";
import prerender from "./nitro-prerender.ts";

export default [...worker, ...dev, ...prerender] as const;
