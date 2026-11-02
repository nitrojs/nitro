import worker from "./base-worker.ts";
import dev from "./nitro-dev.ts";
import prerender from "./nitro-prerender.ts";
import serve from "./nitro-serve.ts";

export default [...worker, ...dev, ...prerender, ...serve] as const;
