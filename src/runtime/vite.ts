import { fetchService } from "./internal/services.ts";

/**
 * Fetch a request from a Vite environment registered as a service (e.g. `ssr`).
 *
 * @deprecated Use `fetchService()` from `nitro/services`.
 */
export const fetchViteEnv: typeof fetchService = fetchService;
