import type { NitroErrorHandler } from "nitropack/types";

export function defineNitroErrorHandler(
  handler: NitroErrorHandler
): NitroErrorHandler {
  return handler;
}

export type InternalHandlerResponse = {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string | Record<string, any>;
};
