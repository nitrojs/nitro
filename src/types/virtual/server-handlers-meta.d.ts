import type { OperationObject } from "openapi-typescript";
import { NitroRouteMeta } from "nitro/types";

export const handlersMeta: {
  route?: string;
  method?: string;
  meta?: NitroRouteMeta;
}[];
