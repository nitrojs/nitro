import { serverFetch, fetch } from "nitro";
import { serverFetch as runtimeServerFetch, fetch as runtimeFetch } from "nitro/app";

export default async () => ({
  serverFetch: await serverFetch("/api/request-context", {
    context: { custom: true },
  }).then((res) => res.json()),
  fetch: await fetch("/api/request-context", {
    context: { custom: true },
  }).then((res) => res.json()),
  "runtime.serverFetch": await runtimeServerFetch("/api/request-context", {
    context: { custom: true },
  }).then((res) => res.json()),
  "runtime.fetch": await runtimeFetch("/api/request-context", {
    context: { custom: true },
  }).then((res) => res.json()),
});
