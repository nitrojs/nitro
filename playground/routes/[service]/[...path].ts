import { defineHandler, HTTPError } from "h3";

const validServices = new Set(["vue", "fetch", "hono", "h3", "react", "node"]);

export default defineHandler(async (event) => {
  const { service, path } = event.context.params!;
  if (!validServices.has(service)) {
    return HTTPError.status(404, `Service "${service}" not found`);
  }
  return fetch(`/${path || ""}`, {
    // @ts-ignore
    env: service,
  });
});
