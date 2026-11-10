import { HTTPError, toRequest } from "h3";
import { services } from "#nitro/virtual/services";

/**
 * Fetch a request from a service of the app (e.g. `ssr`).
 *
 * @see https://nitro.build/config/build#services
 */
export function fetchService(
  name: string,
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const service = services[name];
  if (!service) {
    throw HTTPError.status(404);
  }
  return Promise.resolve(service.fetch(toRequest(input, init)));
}
