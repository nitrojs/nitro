import type { NitroErrorHandler } from "nitropack/types";

export function defineNitroErrorHandler(
  handler: NitroErrorHandler
): NitroErrorHandler {
  return handler;
}
