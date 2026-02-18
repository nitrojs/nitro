import { HTTPError, toRequest } from "h3";

type FetchableEnv = {
  fetch: (request: Request) => Response | Promise<Response>;
};

declare global {
  var __nitro_vite_envs__: Record<string, FetchableEnv>;
}

export function fetchViteEnv(
  viteEnvName: string,
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const envs = globalThis.__nitro_vite_envs__ || {};
  const viteEnv = envs[viteEnvName as keyof typeof envs] as FetchableEnv;
  if (!viteEnv) {
    throw HTTPError.status(404);
  }
  return Promise.resolve(viteEnv.fetch(toRequest(input, init)));
}
