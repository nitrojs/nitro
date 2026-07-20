import type { NitroErrorHandler } from "nitro/types";

export function defineNitroErrorHandler(handler: NitroErrorHandler): NitroErrorHandler {
  return handler;
}

export type InternalHandlerResponse = {
  status?: number;
  statusText?: string | undefined;
  headers?: HeadersInit;
  body?: string | Record<string, any>;
};
