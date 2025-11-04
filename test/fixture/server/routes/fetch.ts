import {
  serverFetch as runtimeServerFetch,
  fetch as runtimeFetch,
} from "nitro/runtime";

import { serverFetch as nitroServerFetch, fetch as nitroFetch } from "nitro";

export default defineHandler(async (event) => {
  const nitroApp = useNitroApp();
  return {
    "nitroApp.fetch": await nitroApp
      .fetch(new Request(new URL("/api/hello", "http://localhost")))
      .then((res) => res.json()),
    "nitro/runtime.serverFetch": await runtimeServerFetch("/api/hello").then(
      (res) => res.json()
    ),
    "nitro/runtime.fetch": await runtimeFetch("/api/hello").then((res) =>
      res.json()
    ),
    "nitro/serverFetch": await nitroServerFetch("/api/hello").then((res) =>
      res.json()
    ),
    "nitro/fetch": await nitroFetch("/api/hello").then((res) => res.json()),
  };
});
