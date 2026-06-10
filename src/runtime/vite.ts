import { HTTPError, toRequest } from "h3";
import { viteServices } from "#nitro/virtual/vite-services";

export function fetchViteEnv(
  viteEnvName: string,
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const viteEnv = viteServices[viteEnvName];
  if (!viteEnv) {
    throw HTTPError.status(404);
  }
  return Promise.resolve(viteEnv.fetch(toRequest(input, init)));
}
