import { createRequestHandler } from "react-router";

export default {
  fetch: createRequestHandler(
    () => import("virtual:react-router/server-build"),
    import.meta.env.MODE
  ),
};
