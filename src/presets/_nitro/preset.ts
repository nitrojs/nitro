import worker from "./base-worker";
import dev from "./nitro-dev";
import prerender from "./nitro-prerender";

export default [...worker, ...dev, ...prerender] as const;
