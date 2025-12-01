import { createQwikRouter } from "@qwik.dev/router/middleware/node";
import render from "./entry.ssr.tsx";

export default createQwikRouter({ render });
