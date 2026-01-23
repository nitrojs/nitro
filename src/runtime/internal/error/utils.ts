import type { NitroErrorHandler } from "nitro/types";

export function defineNitroErrorHandler(handler: NitroErrorHandler): NitroErrorHandler {
  return handler;
}

export type InternalHandlerResponse = {
  status: number;
  statusText: string | undefined;
  headers: Record<string, string>;
  body: string | Record<string, any>;
};
